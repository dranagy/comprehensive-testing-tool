import { v4 as uuidv4 } from "uuid";
import type { TestPhase } from "../../../shared/types.js";
import type {
  DocumentSection,
  TestCaseDefinition,
} from "../types.js";
import type { TestStep, TestAssertion } from "../../../shared/types.js";

/**
 * Builds TestCaseDefinition objects from a single DocumentSection that has
 * been classified as a test case (or contains test-case-like content).
 *
 * The builder uses simple heuristics to identify numbered steps, expected
 * results, and common action verbs (click, enter, navigate, wait) in order
 * to produce structured TestStep and TestAssertion arrays.
 */
export class PromptBuilder {
  /**
   * Parse a single DocumentSection and extract zero or more TestCaseDefinitions.
   *
   * A section may contain multiple test cases if it uses sub-headers like
   * "TC-NNN:" or numbered blocks. Each discovered test case is returned as
   * a separate TestCaseDefinition.
   */
  buildFromSection(section: DocumentSection): TestCaseDefinition[] {
    const definitions: TestCaseDefinition[] = [];
    const content = section.content;

    // Try to split the section into individual test case blocks.
    // Patterns: "TC-NNN:" or numbered "Test Case N" headings within the content.
    const testCaseBlocks = this.splitTestCaseBlocks(content, section.title);

    for (const block of testCaseBlocks) {
      const definition = this.parseTestCaseBlock(block, section.title);
      if (definition) {
        definitions.push(definition);
      }
    }

    return definitions;
  }

  // ---------------------------------------------------------------------------
  // Block splitting
  // ---------------------------------------------------------------------------

  /**
   * Split section content into individual test case blocks.
   * If there is no TC- or numbered sub-structure, the entire section is
   * treated as a single block.
   */
  private splitTestCaseBlocks(
    content: string,
    sectionTitle: string,
  ): Array<{ title: string; content: string }> {
    const blocks: Array<{ title: string; content: string }> = [];

    // Look for TC-NNN: or "Test Case N:" markers inside the content
    const tcPattern = /(?:^|\n)\s*(?:TC-\d+|Test Case\s+\d+)\s*[:.]?\s*(.+)/gi;
    const matches = [...content.matchAll(tcPattern)];

    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const title = (match[1] ?? "").trim();
        const blockStart = (match.index ?? 0) + match[0].length;
        const blockEnd =
          i + 1 < matches.length
            ? matches[i + 1].index ?? content.length
            : content.length;
        const blockContent = content.substring(blockStart, blockEnd).trim();

        blocks.push({
          title: title || `Test Case ${i + 1}`,
          content: blockContent,
        });
      }
    } else {
      // Single block -- the whole section is one test case
      blocks.push({ title: sectionTitle, content });
    }

    return blocks;
  }

  // ---------------------------------------------------------------------------
  // Single test case parsing
  // ---------------------------------------------------------------------------

  private parseTestCaseBlock(
    block: { title: string; content: string },
    sectionTitle: string,
  ): TestCaseDefinition | null {
    const steps = this.extractSteps(block.content);
    const assertions = this.extractAssertions(block.content);

    // If we couldn't find any steps or assertions, skip this block
    if (steps.length === 0 && assertions.length === 0) {
      return null;
    }

    const id = uuidv4();
    const name = block.title || sectionTitle;
    const description = this.extractDescription(block.content);

    return {
      id,
      name,
      description,
      steps,
      assertions,
      sourceDocument: "",
      phase: "FUNCTIONAL" as TestPhase,
    };
  }

  // ---------------------------------------------------------------------------
  // Step extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract TestStep entries from numbered lines like "1. Click the login button"
   * or bullet points like "- Navigate to /home".
   */
  private extractSteps(content: string): TestStep[] {
    const steps: TestStep[] = [];

    // Match numbered steps: "1. Do something" or "1) Do something"
    const numberedLinePattern =
      /(?:^|\n)\s*(\d+)[.)]\s+(.+?)(?=(?:\n\s*\d+[.)])|$)/gis;
    const matches = [...content.matchAll(numberedLinePattern)];

    for (const match of matches) {
      const rawDescription = (match[2] ?? "").trim();
      if (!rawDescription) continue;

      const step = this.parseStepFromDescription(rawDescription);
      steps.push(step);
    }

    // If no numbered steps found, try bullet points: "- Do something"
    if (steps.length === 0) {
      const bulletPattern = /(?:^|\n)\s*[-*]\s+(.+?)(?=(?:\n\s*[-*])|$)/gis;
      const bulletMatches = [...content.matchAll(bulletPattern)];

      for (const match of bulletMatches) {
        const rawDescription = (match[1] ?? "").trim();
        if (!rawDescription) continue;

        const step = this.parseStepFromDescription(rawDescription);
        steps.push(step);
      }
    }

    return steps;
  }

  /**
   * Convert a natural-language step description into a structured TestStep
   * using action heuristics.
   */
  private parseStepFromDescription(description: string): TestStep {
    const lower = description.toLowerCase();

    // "enter X in Y" / "type X in Y" / "input X into Y"
    const typeMatch = lower.match(
      /(?:enter|type|input)\s+["']?(.+?)["']?\s+(?:in|into|on)\s+(?:the\s+)?(.+)/i,
    );
    if (typeMatch) {
      const value = typeMatch[1].replace(/["']/g, "").trim();
      const target = typeMatch[2].replace(/["']/g, "").trim();
      return {
        action: "type",
        selector: this.deriveSelector(target),
        value,
        description,
      };
    }

    // "click X" / "press X" / "select X"
    const clickMatch = lower.match(
      /(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?(.+)/i,
    );
    if (clickMatch) {
      const target = clickMatch[1].replace(/["']/g, "").trim();
      return {
        action: "click",
        selector: this.deriveSelector(target),
        description,
      };
    }

    // "navigate to X" / "go to X" / "open X"
    const navMatch = lower.match(/(?:navigate\s+to|go\s+to|open)\s+(.+)/i);
    if (navMatch) {
      const target = navMatch[1].replace(/["']/g, "").trim();
      return {
        action: "navigate",
        selector: target,
        value: target,
        description,
      };
    }

    // "wait for X" / "wait until X"
    const waitMatch = lower.match(/(?:wait\s+(?:for|until))\s+(.+)/i);
    if (waitMatch) {
      const target = waitMatch[1].replace(/["']/g, "").trim();
      return {
        action: "wait",
        selector: this.deriveSelector(target),
        description,
      };
    }

    // "submit X" / "submit the X"
    const submitMatch = lower.match(/(?:submit)\s+(?:the\s+)?(.+)/i);
    if (submitMatch) {
      const target = submitMatch[1].replace(/["']/g, "").trim();
      return {
        action: "submit",
        selector: this.deriveSelector(target),
        description,
      };
    }

    // "select X from Y" / "select X"
    const selectMatch = lower.match(
      /(?:select)\s+["']?(.+?)["']?\s+(?:from|in)\s+(?:the\s+)?(.+)/i,
    );
    if (selectMatch) {
      const value = selectMatch[1].replace(/["']/g, "").trim();
      const target = selectMatch[2].replace(/["']/g, "").trim();
      return {
        action: "select",
        selector: this.deriveSelector(target),
        value,
        description,
      };
    }

    // Default fallback: generic action
    return {
      action: "click",
      selector: this.deriveSelector(description),
      description,
    };
  }

  /**
   * Derive a CSS-like selector from a natural-language description.
   * Uses common heuristics: "login button" -> "button:has-text('Login')",
   * "username field" -> "[name='username']", etc.
   */
  private deriveSelector(description: string): string {
    const lower = description.toLowerCase().trim();

    // "X button" -> button text selector
    const buttonMatch = lower.match(/^(.+?)\s+button$/);
    if (buttonMatch) {
      return `button:has-text("${this.titleCase(buttonMatch[1])}")`;
    }

    // "X link" -> link text selector
    const linkMatch = lower.match(/^(.+?)\s+link$/);
    if (linkMatch) {
      return `a:has-text("${this.titleCase(linkMatch[1])}")`;
    }

    // "X field" / "X input" / "X textbox" -> name attribute selector
    const fieldMatch = lower.match(
      /^(.+?)\s+(?:field|input|textbox|text box)$/,
    );
    if (fieldMatch) {
      return `[name="${fieldMatch[1].replace(/\s+/g, "-")}"]`;
    }

    // "X dropdown" / "X select" -> name attribute selector
    const dropdownMatch = lower.match(/^(.+?)\s+(?:dropdown|select)$/);
    if (dropdownMatch) {
      return `select[name="${dropdownMatch[1].replace(/\s+/g, "-")}"]`;
    }

    // "X checkbox" -> checkbox selector
    const checkboxMatch = lower.match(/^(.+?)\s+checkbox$/);
    if (checkboxMatch) {
      return `input[type="checkbox"][name="${checkboxMatch[1].replace(/\s+/g, "-")}"]`;
    }

    // Fallback: use the description as a text-based selector
    return `:text("${description}")`;
  }

  // ---------------------------------------------------------------------------
  // Assertion extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract TestAssertion entries from "Expected:" or "Expected Result:" blocks
   * within the test case content.
   */
  private extractAssertions(content: string): TestAssertion[] {
    const assertions: TestAssertion[] = [];

    // Match "Expected:" or "Expected Result:" sections followed by content
    const expectedPattern =
      /expected\s*(?:result)?\s*[:：]\s*\n?([\s\S]+?)(?=\n\s*(?:\d+[.)]|[-*]|expected|$))/gi;
    const matches = [...content.matchAll(expectedPattern)];

    for (const match of matches) {
      const expectedBlock = (match[1] ?? "").trim();
      if (!expectedBlock) continue;

      // Split by numbered or bulleted lines within the expected block
      const lines = expectedBlock
        .split(/\n/)
        .map((l) => l.replace(/^\s*\d+[.)]\s*|^\s*[-*]\s*/, "").trim())
        .filter((l) => l.length > 0);

      for (const line of lines) {
        assertions.push(this.parseAssertionFromLine(line));
      }
    }

    // Also look for inline assertions: "should display X", "should show X"
    if (assertions.length === 0) {
      const inlinePattern =
        /should\s+(?:display|show|contain|have|be)\s+(.+)/gi;
      const inlineMatches = [...content.matchAll(inlinePattern)];

      for (const match of inlineMatches) {
        const expected = (match[1] ?? "").trim().replace(/\.$/, "");
        if (expected) {
          assertions.push({
            type: this.classifyAssertionType(expected),
            expected,
          });
        }
      }
    }

    return assertions;
  }

  /**
   * Parse a single expected-result line into a TestAssertion.
   */
  private parseAssertionFromLine(line: string): TestAssertion {
    const lower = line.toLowerCase();

    // "X is visible" / "X is displayed" / "X appears"
    const visibleMatch = lower.match(
      /(.+?)\s+(?:is\s+)?(?:visible|displayed|shown|appears)/i,
    );
    if (visibleMatch) {
      const target = visibleMatch[1].replace(/["']/g, "").trim();
      return {
        type: "visible",
        expected: "true",
        selector: this.deriveSelector(target),
      };
    }

    // "X contains Y" / "X shows Y"
    const textMatch = lower.match(
      /(?:page|screen|title|heading|text|element)\s+(?:contains|shows?|displays?|should\s+be)\s+["']?(.+?)["']?\s*$/i,
    );
    if (textMatch) {
      return {
        type: "text",
        expected: textMatch[1].replace(/["']/g, "").trim(),
      };
    }

    // "URL is X" / "redirected to X"
    const urlMatch = lower.match(
      /(?:url|page|redirect(?:ed)?)\s+(?:is|to|should\s+be)\s+["']?(.+?)["']?\s*$/i,
    );
    if (urlMatch) {
      return {
        type: "url",
        expected: urlMatch[1].replace(/["']/g, "").trim(),
      };
    }

    // Default: text assertion
    return {
      type: "text",
      expected: line,
    };
  }

  /**
   * Classify what kind of assertion type to use based on the expected text.
   */
  private classifyAssertionType(expected: string): TestAssertion["type"] {
    if (/^https?:\/\//i.test(expected) || /^\/[^/]/.test(expected)) {
      return "url";
    }
    if (/visible|displayed|shown|appear/i.test(expected)) {
      return "visible";
    }
    return "text";
  }

  // ---------------------------------------------------------------------------
  // Description extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract a short description from the test case content.
   * Takes the first non-empty, non-step, non-expected line.
   */
  private extractDescription(content: string): string {
    const lines = content.split(/\n/).map((l) => l.trim());

    for (const line of lines) {
      // Skip empty lines, numbered steps, bullet points, expected sections
      if (!line) continue;
      if (/^\d+[.)]\s/.test(line)) continue;
      if (/^[-*]\s/.test(line)) continue;
      if (/^expected\s*/i.test(line)) continue;

      // Use the first meaningful line as the description
      return line.substring(0, 200);
    }

    return "";
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private titleCase(str: string): string {
    return str
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

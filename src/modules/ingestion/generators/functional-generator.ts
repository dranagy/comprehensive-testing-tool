import type { TestPhase } from "../../../shared/types.js";
import type {
  ParsedDocument,
  TestCaseDefinition,
} from "../types.js";
import { PromptBuilder } from "./prompt-builder.js";

/**
 * Orchestrates the generation of functional test case definitions from
 * a collection of parsed documents.
 *
 * For each document's sections the generator delegates to PromptBuilder to
 * extract structured TestCaseDefinition objects. Results are deduplicated by
 * name and assigned the FUNCTIONAL phase.
 */
export class FunctionalTestGenerator {
  private promptBuilder: PromptBuilder;

  constructor() {
    this.promptBuilder = new PromptBuilder();
  }

  /**
   * Generate TestCaseDefinition objects from all sections across the given
   * parsed documents.
   *
   * @param parsedDocs - Array of ParsedDocument objects produced by DocumentIngester.
   * @returns Deduplicated array of TestCaseDefinition objects with phase set to FUNCTIONAL.
   */
  async generate(
    parsedDocs: ParsedDocument[],
  ): Promise<TestCaseDefinition[]> {
    const allDefinitions: TestCaseDefinition[] = [];

    for (const doc of parsedDocs) {
      for (const section of doc.sections) {
        const definitions =
          this.promptBuilder.buildFromSection(section);

        // Attach source document filename and ensure phase is FUNCTIONAL
        for (const def of definitions) {
          def.sourceDocument = doc.filename;
          def.phase = "FUNCTIONAL" as TestPhase;
          allDefinitions.push(def);
        }
      }
    }

    // Deduplicate by name -- keep the first occurrence
    const seenNames = new Set<string>();
    const uniqueDefinitions: TestCaseDefinition[] = [];

    for (const def of allDefinitions) {
      if (!seenNames.has(def.name)) {
        seenNames.add(def.name);
        uniqueDefinitions.push(def);
      }
    }

    return uniqueDefinitions;
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import type { DocumentFormat } from "../../shared/types.js";
import type { ParsedDocument, DocumentSection } from "./types.js";

/**
 * Custom error thrown when ingestion fails due to an unsupported file format
 * or any processing error during document parsing.
 */
export class IngestionError extends Error {
  public readonly filePath: string;
  public readonly supportedFormats: string[];

  constructor(filePath: string, message: string) {
    const supportedFormats = [".pdf", ".docx", ".txt", ".md"];
    const fullMessage =
      `${message}\n` +
      `  File: ${filePath}\n` +
      `  Supported formats: ${supportedFormats.join(", ")}`;
    super(fullMessage);
    this.name = "IngestionError";
    this.filePath = filePath;
    this.supportedFormats = supportedFormats;
  }
}

/**
 * Responsible for reading a document file from disk, extracting its raw text
 * content, and splitting it into classified DocumentSection objects.
 *
 * Supported formats: PDF (.pdf), Word (.docx), plain text (.txt), Markdown (.md).
 */
export class DocumentIngester {
  /**
   * Ingest a single file and return a fully parsed document.
   *
   * @param filePath - Absolute or relative path to the document file.
   * @returns A ParsedDocument with extracted text and classified sections.
   * @throws {IngestionError} If the file format is unsupported or parsing fails.
   */
  async ingest(filePath: string): Promise<ParsedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const format = this.detectFormat(ext);
    const filename = path.basename(filePath);

    let text: string;

    try {
      switch (format) {
        case "TXT":
          text = await this.readPlainText(filePath);
          break;
        case "MARKDOWN":
          text = await this.readPlainText(filePath);
          break;
        case "PDF":
          text = await this.readPdf(filePath);
          break;
        case "DOCX":
          text = await this.readDocx(filePath);
          break;
        default:
          throw new IngestionError(
            filePath,
            `Unsupported file format: "${ext}".`,
          );
      }
    } catch (error) {
      if (error instanceof IngestionError) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      throw new IngestionError(
        filePath,
        `Failed to parse document: ${message}`,
      );
    }

    const sections = this.splitIntoSections(text);

    return {
      filename,
      format,
      text,
      sections,
    };
  }

  // ---------------------------------------------------------------------------
  // Format detection
  // ---------------------------------------------------------------------------

  private detectFormat(ext: string): DocumentFormat {
    switch (ext) {
      case ".pdf":
        return "PDF";
      case ".docx":
        return "DOCX";
      case ".txt":
        return "TXT";
      case ".md":
      case ".markdown":
        return "MARKDOWN";
      default:
        throw new IngestionError(
          `unknown${ext}`,
          `Unsupported file extension: "${ext}".`,
        );
    }
  }

  // ---------------------------------------------------------------------------
  // Text extraction helpers
  // ---------------------------------------------------------------------------

  private async readPlainText(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf-8");
  }

  private async readPdf(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const data = await pdf(buffer);
    return data.text;
  }

  private async readDocx(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  // ---------------------------------------------------------------------------
  // Section splitting & classification
  // ---------------------------------------------------------------------------

  /**
   * Split raw document text into sections based on markdown ## headings
   * or TC- prefixed test case headers.
   */
  private splitIntoSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];

    // Pattern matches:
    //   ## TC-001: Some title
    //   ## Test Case: Some title
    //   ## Any Heading
    // Also matches standalone lines like "TC-001: Some title" (without ##)
    const sectionPattern =
      /(?:^|\n)(?:##\s+)?(?:TC-\d+\s*:\s*|Test Case\s*:\s*|\*\*\s*)?(.+?)(?:\s*\*\*)?(?:\n|$)/gi;

    const matches = [...text.matchAll(sectionPattern)];

    if (matches.length === 0) {
      // No heading structure found -- treat the entire text as a single section
      if (text.trim().length > 0) {
        sections.push({
          title: "Untitled",
          content: text.trim(),
          type: this.classifySection(text),
        });
      }
      return sections;
    }

    // If there is text before the first heading, capture it as an intro section
    const firstMatchIndex = matches[0].index ?? 0;
    if (firstMatchIndex > 0) {
      const preamble = text.substring(0, firstMatchIndex).trim();
      if (preamble.length > 0) {
        sections.push({
          title: "Introduction",
          content: preamble,
          type: this.classifySection(preamble),
        });
      }
    }

    // Extract content between each heading
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const title = (match[1] ?? "Untitled").trim();
      const contentStart = (match.index ?? 0) + match[0].length;
      const contentEnd =
        i + 1 < matches.length
          ? matches[i + 1].index ?? text.length
          : text.length;
      const content = text.substring(contentStart, contentEnd).trim();

      if (title.length > 0 || content.length > 0) {
        sections.push({
          title,
          content,
          type: this.classifySection(content),
        });
      }
    }

    return sections;
  }

  /**
   * Classify a section based on keyword heuristics:
   *  - Contains "steps" AND "expected" (or "result") -> "test_case"
   *  - Contains "must" OR "should" (requirement language) -> "requirement"
   *  - Everything else -> "other"
   */
  private classifySection(content: string): DocumentSection["type"] {
    const lower = content.toLowerCase();

    const hasSteps = /\bsteps?\b/.test(lower);
    const hasExpected =
      /\bexpected\b/.test(lower) || /\bresult\b/.test(lower);
    const hasRequirement =
      /\bmust\b/.test(lower) || /\bshould\b/.test(lower);

    if (hasSteps && hasExpected) {
      return "test_case";
    }

    if (hasRequirement) {
      return "requirement";
    }

    return "other";
  }
}

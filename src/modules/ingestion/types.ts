import type { DocumentFormat, TestPhase } from "../../shared/types.js";
import type { TestStep, TestAssertion } from "../../shared/types.js";

/**
 * Represents a single section within a parsed document.
 * Sections are delimited by markdown headings (##) or TC- prefixed headers.
 */
export interface DocumentSection {
  title: string;
  content: string;
  type: "test_case" | "behavior" | "requirement" | "other";
}

/**
 * The result of ingesting a single document file.
 * Contains the full extracted text and the document split into classified sections.
 */
export interface ParsedDocument {
  filename: string;
  format: DocumentFormat;
  text: string;
  sections: DocumentSection[];
}

/**
 * Extended test case definition produced during ingestion.
 * Wraps the shared TestCaseDefinition concept with metadata needed
 * for generation: a unique id, name, description, source document reference,
 * and the target testing phase.
 */
export interface TestCaseDefinition {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  assertions: TestAssertion[];
  sourceDocument: string;
  phase: TestPhase;
}

export type { TestStep, TestAssertion };

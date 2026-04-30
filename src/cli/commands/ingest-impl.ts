import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { DocumentIngester } from "../../modules/ingestion/ingester.js";
import { FunctionalTestGenerator } from "../../modules/ingestion/generators/functional-generator.js";
import type { TestCase } from "../../shared/types.js";

export async function ingestCommand(
  files: string[],
  options: { session?: string },
): Promise<void> {
  try {
    const cttDir = path.join(process.cwd(), ".ctt");
    if (!fs.existsSync(cttDir)) {
      fs.mkdirSync(cttDir, { recursive: true });
    }
    const db = initializeDatabase(path.join(cttDir, "sessions.db"));

    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);

    // Resolve session
    const sessions = sessionManager.listSessions();
    if (sessions.length === 0) {
      console.error(
        "No sessions found. Run 'ctt init' to create a project first.",
      );
      db.close();
      process.exit(1);
      return;
    }

    let sessionId: string;
    if (options.session) {
      sessionId = options.session;
    } else {
      // Use the latest session
      sessionId = sessions[0].id;
    }

    // Verify session exists
    const session = sessionManager.getSession(sessionId);

    console.log(`Ingesting documents for session: ${session.name} (${session.id})`);
    console.log(`  Files to process: ${files.length}`);

    // Ingest documents
    const ingester = new DocumentIngester();
    const generator = new FunctionalTestGenerator();

    let totalDocumentsProcessed = 0;
    let totalTestsGenerated = 0;

    for (const filePath of files) {
      const absolutePath = path.resolve(filePath);
      console.log(`\nProcessing: ${absolutePath}`);

      try {
        // Parse the document
        const parsedDoc = await ingester.ingest(absolutePath);
        totalDocumentsProcessed++;

        console.log(
          `  Format: ${parsedDoc.format}  Sections: ${parsedDoc.sections.length}`,
        );

        // Generate test definitions from parsed document
        const definitions = await generator.generate([parsedDoc]);

        // Store each generated test case
        const testCases: TestCase[] = definitions.map((def) => ({
          id: def.id || uuidv4(),
          sessionId: session.id,
          sourceDocumentId: null,
          phase: def.phase,
          name: def.name,
          description: def.description,
          definition: {
            steps: def.steps,
            assertions: def.assertions,
          },
          approvalStatus: "GENERATED",
          tags: [],
          editHistory: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        testCaseRepo.createMany(testCases);
        totalTestsGenerated += testCases.length;

        console.log(`  Generated ${testCases.length} test case(s)`);

        // Log ingestion
        auditLogger.log(session.id, "DOCUMENT_INGESTED", "system", {
          filename: parsedDoc.filename,
          format: parsedDoc.format,
          sectionsCount: parsedDoc.sections.length,
          testsGenerated: testCases.length,
        });
      } catch (fileError) {
        const msg =
          fileError instanceof Error ? fileError.message : String(fileError);
        console.error(`  Failed to process file: ${msg}`);
        // Continue processing remaining files
      }
    }

    // Log aggregate generation event
    auditLogger.log(session.id, "TESTS_GENERATED", "system", {
      documentsProcessed: totalDocumentsProcessed,
      testsGenerated: totalTestsGenerated,
    });

    console.log("\n--- Ingestion Summary ---");
    console.log(`  Documents processed: ${totalDocumentsProcessed}`);
    console.log(`  Tests generated:     ${totalTestsGenerated}`);

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error during ingestion: ${message}`);
    process.exit(1);
  }
}

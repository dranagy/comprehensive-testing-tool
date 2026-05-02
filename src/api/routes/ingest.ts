import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { v4 as uuidv4 } from "uuid";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { DocumentIngester } from "../../modules/ingestion/ingester.js";
import { FunctionalTestGenerator } from "../../modules/ingestion/generators/functional-generator.js";
import { getDb } from "../db.js";
import { resolveSession } from "../middleware/session-resolver.js";
import "../types.js";
import type { TestCase } from "../../shared/types.js";

const upload = multer({ dest: os.tmpdir() });

export const ingestRouter = Router();

// Upload documents
ingestRouter.post(
  "/:sessionId/upload",
  upload.array("files", 20),
  resolveSession,
  async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const db = getDb();
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);

    const session = req.session!;

    const ingester = new DocumentIngester();
    const generator = new FunctionalTestGenerator();

    const results: Array<{
      filename: string;
      format: string;
      testsGenerated: number;
      error?: string;
    }> = [];

    let totalTests = 0;

    for (const file of files) {
      // Rename the multer temp file to include the original extension so the
      // ingester can detect the file format from the path.
      const originalExt = path.extname(file.originalname).toLowerCase();
      const filePath = originalExt ? `${file.path}${originalExt}` : file.path;
      if (originalExt) {
        fs.renameSync(file.path, filePath);
      }
      try {
        const parsedDoc = await ingester.ingest(filePath);
        const definitions = await generator.generate([parsedDoc]);

        const testCases: TestCase[] = definitions.map((def) => ({
          id: def.id || uuidv4(),
          sessionId: session.id,
          sourceDocumentId: null,
          phase: def.phase,
          name: def.name,
          description: def.description,
          definition: { steps: def.steps, assertions: def.assertions },
          approvalStatus: "GENERATED",
          tags: [],
          editHistory: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        testCaseRepo.createMany(testCases);
        totalTests += testCases.length;

        auditLogger.log(session.id, "DOCUMENT_INGESTED", "api", {
          filename: parsedDoc.filename,
          format: parsedDoc.format,
          testsGenerated: testCases.length,
        });

        results.push({
          filename: file.originalname,
          format: parsedDoc.format,
          testsGenerated: testCases.length,
        });
      } catch (err) {
        results.push({
          filename: file.originalname,
          format: "unknown",
          testsGenerated: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        // Clean up renamed temp file
        if (originalExt) {
          fs.unlink(filePath, () => {});
        }
      }
    }

    auditLogger.log(session.id, "TESTS_GENERATED", "api", {
      documentsProcessed: results.filter((r) => !r.error).length,
      testsGenerated: totalTests,
    });

    res.json({
      documentsProcessed: results.length,
      totalTestsGenerated: totalTests,
      results,
    });
  },
);

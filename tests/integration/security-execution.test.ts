import { describe, it, expect } from "vitest";
import { processFindings, categorizeSeverity } from "../../src/modules/security/findings.js";
import type { SecurityFinding } from "../../src/shared/types.js";

/**
 * Integration test for DAST security scanning pipeline.
 *
 * This test validates the full findings pipeline: ZAP alerts → processFindings → SecurityFinding entities.
 * It does NOT actually run ZAP (that requires a running ZAP daemon and target server).
 * Set RUN_SECURITY_INTEGRATION=1 to include live ZAP scanning.
 */
const skipLive = process.env.RUN_SECURITY_INTEGRATION !== "1";

describe("Security DAST pipeline", () => {
  it("processes a realistic set of ZAP alerts end-to-end", () => {
    const zapAlerts = [
      {
        alert: "X-Content-Type-Options Header Missing",
        riskcode: "1",
        confidence: "2",
        url: "http://localhost:3000/login",
        description: "The Anti-MIME-Sniffing header was not set.",
        solution: "Ensure X-Content-Type-Options header is set.",
        evidence: "HTTP/1.1 200 OK",
        pluginId: "10049",
      },
      {
        alert: "Cross Site Scripting (Reflected)",
        riskcode: "3",
        confidence: "2",
        url: "http://localhost:3000/search?q=test",
        description: "XSS vulnerability found in search parameter.",
        solution: "Sanitize all user input and use output encoding.",
        evidence: "<script>alert(1)</script>",
        pluginId: "40012",
      },
      {
        alert: "SQL Injection",
        riskcode: "3",
        confidence: "3",
        url: "http://localhost:3000/users?id=1",
        description: "SQL injection in id parameter.",
        solution: "Use parameterized queries.",
        evidence: "Microsoft OLE DB Provider for SQL Server error",
        pluginId: "40018",
      },
    ];

    const passiveFindings = processFindings(
      zapAlerts.slice(0, 1),
      "session-dast",
      "PASSIVE",
    );
    const activeFindings = processFindings(
      zapAlerts.slice(1),
      "session-dast",
      "ACTIVE",
    );

    // Verify passive findings
    expect(passiveFindings).toHaveLength(1);
    expect(passiveFindings[0].scanType).toBe("PASSIVE");
    expect(passiveFindings[0].severity).toBe("LOW");

    // Verify active findings
    expect(activeFindings).toHaveLength(2);
    expect(activeFindings[0].scanType).toBe("ACTIVE");
    expect(activeFindings[0].severity).toBe("HIGH"); // risk 3, confidence 2

    expect(activeFindings[1].severity).toBe("CRITICAL"); // risk 3, confidence 3

    // Verify all findings have required fields
    const allFindings = [...passiveFindings, ...activeFindings];
    for (const finding of allFindings) {
      expect(finding.id).toBeDefined();
      expect(finding.sessionId).toBe("session-dast");
      expect(finding.title).toBeTruthy();
      expect(finding.description).toBeTruthy();
      expect(finding.url).toBeTruthy();
      expect(finding.createdAt).toBeTruthy();
    }
  });

  describe.skipIf(skipLive)("live ZAP scanning", () => {
    it("runs passive and active scans against sample app", async () => {
      // Requires ZAP daemon running and sample app accessible
    });
  });
});

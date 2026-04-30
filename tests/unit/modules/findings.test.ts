import { describe, it, expect } from "vitest";
import { processFindings, categorizeSeverity } from "../../../src/modules/security/findings.js";
import type { SecurityFinding, Severity } from "../../../src/shared/types.js";

describe("Security Findings Processor", () => {
  describe("categorizeSeverity", () => {
    it("maps ZAP risk code 3 to HIGH", () => {
      expect(categorizeSeverity("3")).toBe("HIGH");
    });

    it("maps ZAP risk code 2 to MEDIUM", () => {
      expect(categorizeSeverity("2")).toBe("MEDIUM");
    });

    it("maps ZAP risk code 1 to LOW", () => {
      expect(categorizeSeverity("1")).toBe("LOW");
    });

    it("maps ZAP risk code 0 to INFORMATIONAL", () => {
      expect(categorizeSeverity("0")).toBe("INFORMATIONAL");
    });

    it("maps ZAP risk code 3 to CRITICAL when confidence is high", () => {
      expect(categorizeSeverity("3", "3")).toBe("CRITICAL");
    });

    it("defaults to INFORMATIONAL for unknown risk codes", () => {
      expect(categorizeSeverity("99")).toBe("INFORMATIONAL");
    });
  });

  describe("processFindings", () => {
    it("converts ZAP alerts to SecurityFinding entities", () => {
      const zapAlerts = [
        {
          alert: "X-Content-Type-Options Header Missing",
          riskcode: "1",
          confidence: "2",
          url: "http://localhost:3000/login",
          description: "The Anti-MIME-Sniffing header was not set.",
          solution: "Ensure X-Content-Type-Options header is set.",
          evidence: "HTTP/1.1 200 OK",
          reference: "https://owasp.org",
          cweid: "693",
          wascid: "",
          pluginId: "10049",
        },
      ];

      const findings = processFindings(zapAlerts, "session-1", "PASSIVE");

      expect(findings).toHaveLength(1);
      expect(findings[0].sessionId).toBe("session-1");
      expect(findings[0].scanType).toBe("PASSIVE");
      expect(findings[0].severity).toBe("LOW");
      expect(findings[0].category).toContain("10049");
      expect(findings[0].title).toContain("X-Content-Type-Options");
      expect(findings[0].url).toBe("http://localhost:3000/login");
      expect(findings[0].remediation).toContain("X-Content-Type-Options");
      expect(findings[0].evidence).toContain("HTTP/1.1 200 OK");
    });

    it("assigns correct severity for HIGH risk alerts", () => {
      const zapAlerts = [
        {
          alert: "Cross Site Scripting (Reflected)",
          riskcode: "3",
          confidence: "2",
          url: "http://localhost:3000/search?q=test",
          description: "XSS vulnerability found.",
          solution: "Sanitize input.",
          evidence: "<script>alert(1)</script>",
          pluginId: "40012",
        },
      ];

      const findings = processFindings(zapAlerts, "session-1", "ACTIVE");

      expect(findings[0].severity).toBe("HIGH");
      expect(findings[0].scanType).toBe("ACTIVE");
    });

    it("assigns CRITICAL severity for high risk + high confidence", () => {
      const zapAlerts = [
        {
          alert: "SQL Injection",
          riskcode: "3",
          confidence: "3",
          url: "http://localhost:3000/users?id=1",
          description: "SQL injection vulnerability.",
          solution: "Use parameterized queries.",
          evidence: "' OR 1=1 --",
          pluginId: "40018",
        },
      ];

      const findings = processFindings(zapAlerts, "session-1", "ACTIVE");

      expect(findings[0].severity).toBe("CRITICAL");
    });

    it("deduplicates alerts with the same pluginId and URL", () => {
      const zapAlerts = [
        {
          alert: "Cookie No HttpOnly Flag",
          riskcode: "1",
          confidence: "2",
          url: "http://localhost:3000/login",
          description: "Cookie missing HttpOnly flag.",
          solution: "Set HttpOnly flag.",
          evidence: "Set-Cookie: session=abc",
          pluginId: "10010",
        },
        {
          alert: "Cookie No HttpOnly Flag",
          riskcode: "1",
          confidence: "2",
          url: "http://localhost:3000/login",
          description: "Cookie missing HttpOnly flag.",
          solution: "Set HttpOnly flag.",
          evidence: "Set-Cookie: session=abc",
          pluginId: "10010",
        },
      ];

      const findings = processFindings(zapAlerts, "session-1", "PASSIVE");

      expect(findings).toHaveLength(1);
    });

    it("handles empty alerts array", () => {
      const findings = processFindings([], "session-1", "PASSIVE");
      expect(findings).toHaveLength(0);
    });

    it("generates unique IDs for each finding", () => {
      const zapAlerts = [
        {
          alert: "Finding A",
          riskcode: "1",
          confidence: "2",
          url: "http://localhost:3000/a",
          description: "Desc A",
          solution: "Fix A",
          evidence: "Ev A",
          pluginId: "10001",
        },
        {
          alert: "Finding B",
          riskcode: "2",
          confidence: "2",
          url: "http://localhost:3000/b",
          description: "Desc B",
          solution: "Fix B",
          evidence: "Ev B",
          pluginId: "10002",
        },
      ];

      const findings = processFindings(zapAlerts, "session-1", "PASSIVE");

      expect(findings).toHaveLength(2);
      expect(findings[0].id).not.toBe(findings[1].id);
    });
  });
});

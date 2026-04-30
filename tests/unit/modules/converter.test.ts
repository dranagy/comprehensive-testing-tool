import { describe, it, expect } from "vitest";
import { convertToArtilleryScenario } from "../../../src/modules/performance/converter.js";
import type { TestCase, PerformanceConfig } from "../../../src/shared/types.js";

function makeFunctionalTest(overrides: Partial<TestCase> & { id: string }): TestCase {
  return {
    id: overrides.id,
    sessionId: "session-perf",
    sourceDocumentId: null,
    phase: "FUNCTIONAL",
    name: `Test ${overrides.id}`,
    description: "A functional test to convert",
    definition: {
      steps: [
        { action: "navigate", selector: "/login", description: "Go to login" },
        { action: "type", selector: "#user", value: "admin", description: "Enter username" },
        { action: "type", selector: "#pass", value: "secret", description: "Enter password" },
        { action: "click", selector: "#submit", description: "Submit" },
      ],
      assertions: [
        { type: "text", expected: "Dashboard" },
      ],
    },
    approvalStatus: "APPROVED",
    tags: [],
    editHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Functional-to-Artillery scenario converter", () => {
  const baseConfig: PerformanceConfig = {
    virtualUsers: 50,
    rampUpSeconds: 10,
    durationSeconds: 60,
  };

  it("converts a functional test into an Artillery scenario with flows", () => {
    const tests = [makeFunctionalTest({ id: "tc-001" })];
    const scenario = convertToArtilleryScenario(tests, baseConfig, "http://localhost:3000");

    expect(scenario.config.target).toBe("http://localhost:3000");
    expect(scenario.scenarios).toHaveLength(1);
    expect(scenario.scenarios[0].flow).toBeDefined();
    expect(scenario.scenarios[0].flow.length).toBeGreaterThan(0);
  });

  it("maps navigate steps to get requests", () => {
    const tests = [makeFunctionalTest({ id: "tc-nav" })];
    const scenario = convertToArtilleryScenario(tests, baseConfig, "http://localhost:3000");

    const firstFlowStep = scenario.scenarios[0].flow[0];
    expect(firstFlowStep).toHaveProperty("get");
  });

  it("maps click steps to get requests on the selector", () => {
    const tests = [makeFunctionalTest({ id: "tc-click" })];
    const scenario = convertToArtilleryScenario(tests, baseConfig, "http://localhost:3000");

    // Click steps should be converted to GET requests
    const clickStep = scenario.scenarios[0].flow.find((s: Record<string, unknown>) => {
      const get = s.get as string | undefined;
      return get && get.includes("/submit");
    });
    expect(clickStep).toBeDefined();
  });

  it("sets the correct phases for ramp-up", () => {
    const tests = [makeFunctionalTest({ id: "tc-ramp" })];
    const scenario = convertToArtilleryScenario(tests, baseConfig, "http://localhost:3000");

    expect(scenario.config.phases).toHaveLength(1);
    expect(scenario.config.phases[0].duration).toBe(60);
    expect(scenario.config.phases[0].arrivalRate).toBeGreaterThan(0);
  });

  it("converts multiple functional tests into separate scenarios", () => {
    const tests = [
      makeFunctionalTest({ id: "tc-001" }),
      makeFunctionalTest({ id: "tc-002" }),
    ];
    const scenario = convertToArtilleryScenario(tests, baseConfig, "http://localhost:3000");

    expect(scenario.scenarios).toHaveLength(2);
  });

  it("produces valid JSON-serializable output", () => {
    const tests = [makeFunctionalTest({ id: "tc-json" })];
    const scenario = convertToArtilleryScenario(tests, baseConfig, "http://localhost:3000");

    const serialized = JSON.stringify(scenario);
    expect(serialized).toBeDefined();

    const parsed = JSON.parse(serialized);
    expect(parsed.config.target).toBe("http://localhost:3000");
  });

  it("handles empty test list", () => {
    const scenario = convertToArtilleryScenario([], baseConfig, "http://localhost:3000");
    expect(scenario.scenarios).toHaveLength(0);
    expect(scenario.config.target).toBe("http://localhost:3000");
  });
});

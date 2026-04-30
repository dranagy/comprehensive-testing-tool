import type { TestCase, PerformanceConfig } from "../../shared/types.js";
import type { ArtilleryScenario } from "./types.js";

/**
 * Convert functional test cases into an Artillery load scenario.
 */
export function convertToArtilleryScenario(
  tests: TestCase[],
  config: PerformanceConfig,
  targetUrl: string,
): ArtilleryScenario {
  const arrivalRate = Math.ceil(config.virtualUsers / Math.max(config.rampUpSeconds, 1));

  const phases: ArtilleryScenario["config"]["phases"] = [
    {
      duration: config.durationSeconds,
      arrivalRate,
    },
  ];

  const scenarios: ArtilleryScenario["scenarios"] = tests.map((tc) => ({
    name: tc.name,
    flow: convertStepsToFlow(tc),
  }));

  return {
    config: {
      target: targetUrl,
      phases,
    },
    scenarios,
  };
}

function convertStepsToFlow(testCase: TestCase): Array<Record<string, unknown>> {
  const flow: Array<Record<string, unknown>> = [];

  for (const step of testCase.definition.steps) {
    switch (step.action) {
      case "navigate": {
        const url = step.value ?? step.selector;
        flow.push({ get: url });
        break;
      }
      case "click": {
        const url = step.selector.replace(/^[#.]/, "/");
        flow.push({ get: url });
        break;
      }
      case "type": {
        // Artillery doesn't have a direct "type" action — model as a POST with form data
        flow.push({
          post: {
            url: "/",
            json: { [step.selector]: step.value ?? "" },
          },
        });
        break;
      }
      case "submit": {
        flow.push({
          post: {
            url: step.selector,
          },
        });
        break;
      }
      case "wait": {
        // Artillery doesn't natively wait; add a think/pause
        flow.push({ think: 1 });
        break;
      }
      case "select": {
        flow.push({
          post: {
            url: "/",
            json: { [step.selector]: step.value ?? "" },
          },
        });
        break;
      }
    }
  }

  return flow;
}

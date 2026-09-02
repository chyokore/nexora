import { describe, expect, it } from "vitest";
import { scenarioById, scenarios } from "./scenarios";

describe("sanitized judge scenarios", () => {
  it.each([
    ["supported", "SUPPORTED"], ["coverage-gap", "FRAUD COVERAGE GAP"], ["contradicted", "CONTRADICTED ONCHAIN"], ["adverse", "VERIFIED ADVERSE"],
  ])("maps %s to its judge-facing name", (id, name) => expect(scenarioById(id as never).name).toBe(name));

  it.each(scenarios)("keeps $name structurally valid", (scenario) => {
    expect(scenario.evidence.length).toBeGreaterThan(0);
    expect(scenario.evidence.every((item) => item.structuralValidity === "MATCH")).toBe(true);
  });

  it.each(scenarios)("labels $name provenance", (scenario) => expect(scenario.provenance).toMatch(/SANITIZED|SYNTHETIC/));

  it.each(scenarios)("provides deterministic lookup for $id", (scenario) => expect(scenarioById(scenario.id)).toBe(scenario));

  it("models fraud out-of-coverage independently of confidence", () => {
    const fraud = scenarioById("coverage-gap").evidence.find((item) => item.intent === "FRAUD_DETECTION");
    expect(fraud).toMatchObject({ coverage: "OUT_OF_COVERAGE", quality: "INSUFFICIENT", providerConfidence: 0 });
  });

  it("models onchain contradiction even with maximum provider confidence", () => {
    const onchain = scenarioById("contradicted").evidence.find((item) => item.intent === "ONCHAIN_TX_LOOKUP");
    expect(onchain).toMatchObject({ verification: "CONTRADICTED", quality: "CONTRADICTED", providerConfidence: 1 });
  });
});

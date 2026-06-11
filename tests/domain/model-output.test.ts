import { describe, expect, it } from "vitest";
import { validateModelOutput } from "../../src/domain/model-output";

describe("validateModelOutput", () => {
  it("filters unknown aliases, de-duplicates tabs, and truncates names", () => {
    const output = validateModelOutput(
      [
        { groupName: "技术资料中心", tabAliases: ["T1", "T2", "T404"] },
        { groupName: "ResearchMaterial", tabAliases: ["T2", "T3"] },
      ],
      {
        mode: "seed",
        allowedTabAliases: new Set(["T1", "T2", "T3"]),
        existingGroups: new Map(),
        maxGroups: 5,
      },
    );

    expect(output).toEqual([
      { groupName: "技术资料", tabAliases: ["T1", "T2"] },
    ]);
  });

  it("allows a singleton continuation assignment to an established category", () => {
    const output = validateModelOutput(
      [{ groupAlias: "C1", tabAliases: ["T9"] }],
      {
        mode: "continuation",
        allowedTabAliases: new Set(["T9"]),
        existingGroups: new Map([["C1", { title: "Research" }]]),
        maxGroups: 5,
      },
    );
    expect(output).toEqual([
      { groupAlias: "C1", groupName: "Research", tabAliases: ["T9"] },
    ]);
  });

  it("rejects malformed values and seed singletons", () => {
    const options = {
      mode: "seed" as const,
      allowedTabAliases: new Set(["T1"]),
      existingGroups: new Map<string, { title: string }>(),
      maxGroups: 5,
    };
    expect(validateModelOutput("bad", options)).toEqual([]);
    expect(
      validateModelOutput(
        [{ groupName: "Solo", tabAliases: ["T1"] }],
        options,
      ),
    ).toEqual([]);
  });

  it("handles non-array tabAliases gracefully", () => {
    const options = {
      mode: "seed" as const,
      allowedTabAliases: new Set(["T1", "T2"]),
      existingGroups: new Map<string, { title: string }>(),
      maxGroups: 5,
    };
    expect(
      validateModelOutput(
        [
          { groupName: "Good", tabAliases: ["T1", "T2"] },
          { groupName: "Bad", tabAliases: "not-an-array" },
          { groupName: "Also Bad", tabAliases: 42 },
        ],
        options,
      ),
    ).toEqual([{ groupName: "Good", tabAliases: ["T1", "T2"] }]);
  });

  it("merges duplicate normalized names before applying the minimum", () => {
    const result = validateModelOutput(
      [
        { groupName: "研究", tabAliases: ["T1"] },
        { groupName: "  研究  ", tabAliases: ["T2"] },
      ],
      {
        mode: "seed",
        allowedTabAliases: new Set(["T1", "T2"]),
        existingGroups: new Map(),
        maxGroups: 5,
      },
    );
    expect(result).toEqual([
      { groupName: "研究", tabAliases: ["T1", "T2"] },
    ]);
  });

  it("ignores unknown aliases and caps valid groups at five", () => {
    const raw = Array.from({ length: 6 }, (_, index) => ({
      groupName: `Group ${index}`,
      tabAliases: [`T${index * 2 + 1}`, `T${index * 2 + 2}`],
    }));
    expect(
      validateModelOutput(raw, {
        mode: "seed",
        allowedTabAliases: new Set(
          Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
        ),
        existingGroups: new Map([["G1", { title: "既存分類" }]]),
        maxGroups: 5,
      }),
    ).toHaveLength(5);
    expect(
      validateModelOutput(
        [{ groupAlias: "G404", tabAliases: ["T1", "T2"] }],
        {
          mode: "seed",
          allowedTabAliases: new Set(["T1", "T2"]),
          existingGroups: new Map(),
          maxGroups: 5,
        },
      ),
    ).toEqual([]);
  });
});

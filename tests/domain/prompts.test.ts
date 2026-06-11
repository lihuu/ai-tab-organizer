import { describe, expect, it } from "vitest";
import { buildBatchPrompt, SYSTEM_PROMPT } from "../../src/domain/prompts";

describe("prompts", () => {
  it("uses English constraints and preserves Chinese metadata", () => {
    expect(SYSTEM_PROMPT).toContain("Return only data");
    expect(
      buildBatchPrompt({
        mode: "seed",
        tabs: [{ alias: "T1", title: "接口文档" }],
        groups: [],
      }),
    ).toContain("接口文档");
  });

  it("forbids new categories in continuation mode", () => {
    expect(
      buildBatchPrompt({ mode: "continuation", tabs: [], groups: [] }),
    ).toContain("Do not create categories");
  });
});

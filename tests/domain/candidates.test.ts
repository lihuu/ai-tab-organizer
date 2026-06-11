import { describe, expect, it } from "vitest";
import { prepareCandidates } from "../../src/domain/candidates";

describe("prepareCandidates", () => {
  it("excludes pinned and grouped tabs and exposes aliases instead of tab IDs", () => {
    const result = prepareCandidates([
      { id: 91, windowId: 1, title: "A", url: "https://a.test/x", pinned: false, groupId: -1 },
      { id: 92, windowId: 1, title: "B", url: "https://b.test", pinned: true, groupId: -1 },
      { id: 93, windowId: 1, title: "C", url: "https://c.test", pinned: false, groupId: 4 },
    ]);

    expect(result.items).toEqual([
      {
        alias: "T1",
        title: "A",
        location: { kind: "web", host: "a.test", path: "/x" },
      },
    ]);
    expect(result.tabIdByAlias.get("T1")).toBe(91);
    expect(JSON.stringify(result.items)).not.toContain("91");
  });
});

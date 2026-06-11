import { describe, expect, it, vi } from "vitest";
import { organizeTabs } from "../../src/organizer/organize";

describe("organizeTabs", () => {
  it("falls back when the seed batch has no valid groups", async () => {
    const result = await organizeTabs(makeInput(4), {
      classify: vi.fn().mockResolvedValue([]),
      now: () => 0,
    });
    expect(result.mode).toBe("fallback");
  });

  it("keeps valid seed results when a continuation batch fails", async () => {
    const classify = vi
      .fn()
      .mockResolvedValueOnce([
        { groupName: "Research", tabAliases: ["T1", "T2"] },
      ])
      .mockRejectedValueOnce(new Error("batch-timeout"));
    const result = await organizeTabs(makeInput(51), { classify, now: () => 0 });
    expect(result.mode).toBe("ai");
    expect(result.groups[0]!.tabIds).toEqual([1, 2]);
  });

  it("returns no-op for fewer than two tabs", async () => {
    const classify = vi.fn();
    expect(
      await organizeTabs(makeInput(1), { classify, now: () => 0 }),
    ).toEqual({ mode: "no-op", groups: [] });
    expect(classify).not.toHaveBeenCalled();
  });

  it.each([
    [50, 1],
    [51, 2],
    [103, 3],
  ])("classifies %i tabs in %i batches", async (count, expectedCalls) => {
    const classify = vi.fn(async ({ mode }) =>
      mode === "seed"
        ? [{ groupName: "Research", tabAliases: ["T1", "T2"] }]
        : [],
    );
    await organizeTabs(makeInput(count), { classify, now: () => 0 });
    expect(classify).toHaveBeenCalledTimes(expectedCalls);
  });

  it("stops continuation work at the 60-second deadline", async () => {
    const times = [0, 0, 60_000];
    const classify = vi.fn(async () => [
      { groupName: "Research", tabAliases: ["T1", "T2"] },
    ]);
    await organizeTabs(makeInput(103), {
      classify,
      now: () => times.shift() ?? 60_000,
    });
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it("preserves existing group IDs and maps aliases back to tab IDs", async () => {
    const input = {
      ...makeInput(2),
      existingGroups: [
        { id: 9, alias: "G1", title: "Research", color: "blue" as chrome.tabGroups.Color },
      ],
    };
    const result = await organizeTabs(input, {
      classify: vi.fn(async () => [
        { groupAlias: "G1", tabAliases: ["T1", "T2"] },
      ]),
      now: () => 0,
    });
    expect(result.groups).toEqual([
      { title: "Research", tabIds: [1, 2], existingGroupId: 9 },
    ]);
    expect(JSON.stringify(result)).not.toContain("groupAlias");
  });
});

function makeInput(count: number) {
  return {
    tabs: Array.from({ length: count }, (_, index) => ({
      alias: `T${index + 1}`,
      tabId: index + 1,
      title: `Tab ${index + 1}`,
      host: `topic${index % 6}.example${index % 6}.com`,
    })),
    existingGroups: [],
  };
}

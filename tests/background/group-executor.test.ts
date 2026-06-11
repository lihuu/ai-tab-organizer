import { describe, expect, it, vi } from "vitest";
import { GroupExecutor } from "../../src/background/group-executor";
import { fakeChrome } from "../helpers/fake-chrome";

describe("GroupExecutor", () => {
  it("reuses a same-name group and skips changed tabs", async () => {
    const api = fakeChrome({
      tabs: [
        { id: 1, windowId: 4, pinned: false, groupId: -1 } as chrome.tabs.Tab,
        { id: 2, windowId: 4, pinned: true, groupId: -1 } as chrome.tabs.Tab,
      ],
      groups: [
        {
          id: 8,
          windowId: 4,
          title: "Research",
          color: "blue",
        } as chrome.tabGroups.TabGroup,
      ],
    });
    const summary = await new GroupExecutor(api).execute(4, [
      { title: "Research", tabIds: [1, 2] },
    ]);
    expect(api.tabs.group).toHaveBeenCalledWith({ groupId: 8, tabIds: [1] });
    expect(summary.tabsGrouped).toBe(1);
    expect(summary.tabsSkipped).toBe(1);
  });

  it("continues after one group fails", async () => {
    const api = fakeChromeForPartialFailure();
    const summary = await new GroupExecutor(api).execute(4, [
      { title: "One", tabIds: [1, 2] },
      { title: "Two", tabIds: [3, 4] },
    ]);
    expect(summary.tabsFailed).toBe(2);
    expect(summary.tabsGrouped).toBe(2);
  });

  it("skips closed, moved, pinned, and manually grouped tabs", async () => {
    const api = fakeChrome({
      tabs: [
        { id: 2, windowId: 99, pinned: false, groupId: -1 },
        { id: 3, windowId: 4, pinned: true, groupId: -1 },
        { id: 4, windowId: 4, pinned: false, groupId: 7 },
      ] as chrome.tabs.Tab[],
    });
    const summary = await new GroupExecutor(api).execute(4, [
      { title: "Work", tabIds: [1, 2, 3, 4] },
    ]);
    expect(summary.tabsSkipped).toBe(4);
    expect(api.tabs.group).not.toHaveBeenCalled();
  });

  it("caps execution at five plans", async () => {
    const tabs = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      windowId: 4,
      pinned: false,
      groupId: -1,
    })) as chrome.tabs.Tab[];
    const api = fakeChrome({ tabs });
    await new GroupExecutor(api, () => "blue").execute(
      4,
      Array.from({ length: 6 }, (_, index) => ({
        title: `G${index}`,
        tabIds: [index * 2 + 1, index * 2 + 2],
      })),
    );
    expect(api.tabs.group).toHaveBeenCalledTimes(5);
  });
});

function fakeChromeForPartialFailure() {
  const api = fakeChrome({
    tabs: [1, 2, 3, 4].map((id) => ({
      id,
      windowId: 4,
      pinned: false,
      groupId: -1,
    })) as chrome.tabs.Tab[],
  });
  const group = api.tabs.group as unknown as ReturnType<typeof vi.fn>;
  group
    .mockRejectedValueOnce(new Error("first-group-failed"))
    .mockResolvedValueOnce(101);
  return api;
}

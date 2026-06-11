import { describe, expect, it } from "vitest";
import { ChromeTabSource } from "../../src/background/tab-source";
import { fakeChrome } from "../helpers/fake-chrome";

describe("ChromeTabSource", () => {
  it("returns only ungrouped, unpinned tabs with IDs", async () => {
    const chromeApi = fakeChrome({
      tabs: [
        { id: 1, windowId: 9, title: "A", url: "https://a.test", pinned: false, groupId: -1 },
        { id: 2, windowId: 9, title: "B", url: "https://b.test", pinned: true, groupId: -1 },
      ] as chrome.tabs.Tab[],
    });
    const result = await new ChromeTabSource(chromeApi).prepare(9);
    expect(result.tabs.map((tab) => tab.id)).toEqual([1]);
  });

  it("maps existing groups and tolerates missing optional tab fields", async () => {
    const api = fakeChrome({
      tabs: [
        { id: 1, windowId: 9, pinned: false, groupId: -1 },
        { windowId: 9, pinned: false, groupId: -1 },
        { id: 3, windowId: 9, pinned: false, groupId: 8 },
      ] as chrome.tabs.Tab[],
      groups: [
        { id: 8, windowId: 9, title: "Work", color: "blue", collapsed: false, shared: false },
      ],
    });
    const result = await new ChromeTabSource(api).prepare(9);
    expect(result.tabs).toEqual([
      { id: 1, windowId: 9, title: "", url: "", pinned: false, groupId: -1 },
    ]);
    expect(result.existingGroups).toEqual([
      { id: 8, title: "Work", color: "blue" },
    ]);
  });
});

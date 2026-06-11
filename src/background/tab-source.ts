import type { ExistingGroup, PreparedTask, TabSnapshot } from "../shared/types";

export class ChromeTabSource {
  constructor(private readonly api: typeof chrome = chrome) {}

  async prepare(windowId: number): Promise<Omit<PreparedTask, "taskId">> {
    const [tabs, groups] = await Promise.all([
      this.api.tabs.query({ windowId }),
      this.api.tabGroups.query({ windowId }),
    ]);
    return {
      windowId,
      tabs: tabs
        .filter(
          (tab) =>
            tab.id !== undefined &&
            !tab.pinned &&
            tab.groupId === this.api.tabGroups.TAB_GROUP_ID_NONE,
        )
        .map(
          (tab): TabSnapshot => ({
            id: tab.id!,
            windowId,
            title: tab.title ?? "",
            url: tab.url ?? "",
            pinned: false,
            groupId: tab.groupId,
          }),
        ),
      existingGroups: groups.map(
        (group): ExistingGroup => ({
          id: group.id,
          title: group.title ?? "",
          color: group.color,
        }),
      ),
    };
  }
}

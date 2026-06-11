import { normalizeGroupName } from "../domain/group-name";
import type { ExecutionSummary, PlannedGroup } from "../shared/types";

const COLORS: Array<`${chrome.tabGroups.Color}`> = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
];

export class GroupExecutor {
  constructor(
    private readonly api: typeof chrome = chrome,
    private readonly pickColor: () => `${chrome.tabGroups.Color}` = () =>
      COLORS[
        crypto.getRandomValues(new Uint32Array(1))[0]! % COLORS.length
      ]!,
  ) {}

  async execute(
    windowId: number,
    plans: PlannedGroup[],
  ): Promise<ExecutionSummary> {
    const summary: ExecutionSummary = {
      groupsCreated: 0,
      groupsReused: 0,
      tabsGrouped: 0,
      tabsSkipped: 0,
      tabsFailed: 0,
    };
    for (const plan of plans.slice(0, 5)) {
      const validIds = await this.revalidate(windowId, plan.tabIds);
      summary.tabsSkipped += plan.tabIds.length - validIds.length;
      if (validIds.length === 0) continue;
      try {
        const existing = await this.findExisting(windowId, plan);
        if (!existing && validIds.length < 2) {
          summary.tabsSkipped += validIds.length;
          continue;
        }
        if (existing) {
          await this.api.tabs.group({
            groupId: existing.id,
            tabIds: validIds as [number, ...number[]],
          });
          summary.groupsReused += 1;
        } else {
          const groupId = await this.api.tabs.group({
            createProperties: { windowId },
            tabIds: validIds as [number, ...number[]],
          });
          await this.api.tabGroups.update(groupId, {
            title: normalizeGroupName(plan.title),
            color: this.pickColor(),
          });
          summary.groupsCreated += 1;
        }
        summary.tabsGrouped += validIds.length;
      } catch {
        summary.tabsFailed += validIds.length;
      }
    }
    return summary;
  }

  private async revalidate(
    windowId: number,
    tabIds: number[],
  ): Promise<number[]> {
    const uniqueIds = [...new Set(tabIds)];
    const results = await Promise.all(
      uniqueIds.map(async (tabId) => {
        try {
          const tab = await this.api.tabs.get(tabId);
          return tab.windowId === windowId &&
            !tab.pinned &&
            tab.groupId === this.api.tabGroups.TAB_GROUP_ID_NONE
            ? tabId
            : undefined;
        } catch {
          return undefined;
        }
      }),
    );
    return results.filter((tabId): tabId is number => tabId !== undefined);
  }

  private async findExisting(
    windowId: number,
    plan: PlannedGroup,
  ): Promise<chrome.tabGroups.TabGroup | undefined> {
    if (plan.existingGroupId !== undefined) {
      try {
        const group = await this.api.tabGroups.get(plan.existingGroupId);
        if (group.windowId === windowId) return group;
      } catch {
        // Continue to same-name lookup.
      }
    }
    const expected = normalizeGroupName(plan.title);
    const groups = await this.api.tabGroups.query({ windowId });
    return groups.find(
      (group) => normalizeGroupName(group.title ?? "") === expected,
    );
  }
}

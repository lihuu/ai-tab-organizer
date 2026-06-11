import { vi } from "vitest";

export function fakeSessionStorage() {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(key: string) {
      return { [key]: data[key] };
    },
    async set(values: Record<string, unknown>) {
      Object.assign(data, values);
    },
    async remove(key: string) {
      delete data[key];
    },
  };
}

export function fakeChrome(input: {
  tabs?: chrome.tabs.Tab[];
  groups?: chrome.tabGroups.TabGroup[];
} = {}) {
  const tabs = input.tabs ?? [];
  const groups = input.groups ?? [];
  return {
    tabs: {
      query: vi.fn(async ({ windowId }: { windowId?: number }) =>
        tabs.filter((tab) => windowId === undefined || tab.windowId === windowId),
      ),
      get: vi.fn(async (tabId: number) => {
        const tab = tabs.find((candidate) => candidate.id === tabId);
        if (!tab) throw new Error("tab-not-found");
        return tab;
      }),
      group: vi.fn(async () => 100),
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      query: vi.fn(async ({ windowId }: { windowId?: number }) =>
        groups.filter((group) => windowId === undefined || group.windowId === windowId),
      ),
      get: vi.fn(async (groupId: number) => {
        const group = groups.find((candidate) => candidate.id === groupId);
        if (!group) throw new Error("group-not-found");
        return group;
      }),
      update: vi.fn(async (groupId: number, changes: object) => ({
        ...groups.find((group) => group.id === groupId),
        ...changes,
      })),
    },
  } as unknown as typeof chrome;
}

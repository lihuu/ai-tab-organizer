import { describe, expect, it, vi } from "vitest";
import { fakeChrome, fakeSessionStorage } from "../helpers/fake-chrome";

describe("background/index service worker", () => {
  it("opens the last-focused window for the shortcut", async () => {
    const commandListeners: Array<(command: string) => void> = [];
    const open = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", {
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        open,
      },
      commands: {
        onCommand: {
          addListener: (listener: (command: string) => void) =>
            commandListeners.push(listener),
        },
      },
      runtime: { onMessage: { addListener: vi.fn() } },
      windows: { getLastFocused: vi.fn(async () => ({ id: 44 })) },
      storage: { session: fakeSessionStorage() },
      tabs: fakeChrome().tabs,
      tabGroups: fakeChrome().tabGroups,
    });
    await import("../../src/background/index");
    commandListeners[0]!("organize-tabs");
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith({ windowId: 44 }));
  });

  it("ignores unknown messages and rejects a stale owner", async () => {
    vi.resetModules();
    let messageListener!: (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => boolean;
    const storage = fakeSessionStorage();
    await storage.set({
      "task:1": {
        windowId: 1,
        ownerToken: "owner-a",
        taskId: "task-a",
        phase: "running",
        processedTabs: 0,
        totalTabs: 2,
        currentBatch: 1,
        totalBatches: 1,
        updatedAt: Date.now(),
      },
    });
    const api = fakeChrome();
    vi.stubGlobal("chrome", {
      sidePanel: {
        setPanelBehavior: vi.fn(async () => undefined),
        open: vi.fn(async () => undefined),
      },
      commands: { onCommand: { addListener: vi.fn() } },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          }),
        },
      },
      windows: { getLastFocused: vi.fn() },
      storage: { session: storage },
      tabs: api.tabs,
      tabGroups: api.tabGroups,
    });
    await import("../../src/background/index");
    expect(
      messageListener(
        { type: "unknown" },
        {} as chrome.runtime.MessageSender,
        vi.fn(),
      ),
    ).toBe(false);

    const sendResponse = vi.fn();
    expect(
      messageListener(
        {
          type: "release-task",
          windowId: 1,
          taskId: "task-a",
          ownerToken: "owner-b",
        },
        {} as chrome.runtime.MessageSender,
        sendResponse,
      ),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: "task-owner-mismatch",
      }),
    );
    expect(JSON.stringify(sendResponse.mock.calls)).not.toMatch(
      /https?:|secret title/,
    );
  });
});

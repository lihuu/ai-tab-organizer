import { GroupExecutor } from "./group-executor";
import { ChromeTabSource } from "./tab-source";
import { TaskStore } from "./task-store";
import { isOrganizerRequest } from "../shared/messages";
import type { OrganizerRequest } from "../shared/messages";

const store = new TaskStore();
const source = new ChromeTabSource();
const executor = new GroupExecutor();

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "organize-tabs") return;
  const window = await chrome.windows.getLastFocused();
  if (window.id !== undefined) await chrome.sidePanel.open({ windowId: window.id });
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (!isOrganizerRequest(message)) return false;
    void handleMessage(message)
      .then((value) => sendResponse({ ok: true, value }))
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "unknown-error",
        }),
      );
    return true;
  },
);

async function handleMessage(message: OrganizerRequest) {
  switch (message.type) {
    case "get-task-state":
      return store.get(message.windowId);
    case "prepare-task": {
      const prepared = await source.prepare(message.windowId);
      const claim = await store.claim(
        message.windowId,
        message.ownerToken,
        prepared.tabs.length,
      );
      if (!claim.acquired) {
        return { status: "busy" as const, state: claim.state };
      }
      return {
        status: "prepared" as const,
        state: claim.state,
        task: { ...prepared, taskId: claim.state.taskId },
      };
    }
    case "update-task-state":
      await assertOwner(
        message.state.windowId,
        message.state.taskId,
        message.state.ownerToken,
      );
      await store.update(message.state);
      return undefined;
    case "execute-groups": {
      await assertOwner(message.windowId, message.taskId, message.ownerToken);
      return executor.execute(message.windowId, message.groups);
    }
    case "release-task":
      await assertOwner(message.windowId, message.taskId, message.ownerToken);
      await store.release(message.windowId, message.taskId, message.ownerToken);
      return undefined;
  }
}

async function assertOwner(
  windowId: number,
  taskId: string,
  ownerToken: string,
): Promise<void> {
  const current = await store.get(windowId);
  if (current?.taskId !== taskId || current.ownerToken !== ownerToken) {
    throw new Error("task-owner-mismatch");
  }
}

import { withLanguageModel, promptWithTimeout } from "../ai/language-model";
import { aliasMap } from "../domain/aliases";
import { prepareCandidates } from "../domain/candidates";
import { createDomainFallback } from "../domain/fallback";
import { MODEL_RESPONSE_SCHEMA } from "../domain/model-output";
import { buildBatchPrompt } from "../domain/prompts";
import { organizeTabs } from "../organizer/organize";
import type { OrganizerResponse, OrganizerRequest } from "../shared/messages";
import type {
  ExecutionSummary,
  PreparedTask,
  TaskState,
} from "../shared/types";
import type { PanelDependencies } from "./model";

async function send<T>(message: OrganizerRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(
    message,
  )) as OrganizerResponse<T>;
  if (!response.ok) throw new Error(response.error);
  return response.value;
}

function toOrganizerInput(task: PreparedTask) {
  const prepared = prepareCandidates(task.tabs);
  const groupAliases = aliasMap("G", task.existingGroups);
  return {
    tabs: prepared.items.map((item) => ({
      alias: item.alias,
      tabId: prepared.tabIdByAlias.get(item.alias)!,
      title: item.title,
      ...(item.location.kind === "web"
        ? {
            host: item.location.host,
            ...(item.location.path ? { path: item.location.path } : {}),
          }
        : {}),
    })),
    existingGroups: groupAliases.aliasByIndex.map((alias) => {
      const group = groupAliases.valueByAlias.get(alias)!;
      return { ...group, alias };
    }),
  };
}

export function createBrowserDependencies(
  onState: (state: TaskState) => void,
): PanelDependencies {
  return {
    async getWindowId() {
      const window = await chrome.windows.getCurrent();
      if (window.id === undefined) throw new Error("window-id-missing");
      return window.id;
    },
    getOwnerToken() {
      const key = "organizer-owner-token";
      const current = sessionStorage.getItem(key);
      if (current) return current;
      const created = crypto.randomUUID();
      sessionStorage.setItem(key, created);
      return created;
    },
    prepare(windowId, ownerToken) {
      return send({
        type: "prepare-task",
        windowId,
        ownerToken,
      });
    },
    async availability() {
      const api = (globalThis as typeof globalThis & {
        LanguageModel?: LanguageModelStatic;
      }).LanguageModel;
      if (!api) return "unavailable" as const;
      return api.availability();
    },
    async organize(task, callbacks) {
      const api = (globalThis as typeof globalThis & {
        LanguageModel?: LanguageModelStatic;
      }).LanguageModel;
      if (!api) throw new Error("model-unavailable");
      const input = toOrganizerInput(task);
      return withLanguageModel(api, callbacks.onDownload, async (session) =>
        organizeTabs(input, {
          now: Date.now,
          onProgress: callbacks.onProgress,
          async classify(batch) {
            const text = await promptWithTimeout(
              session,
              buildBatchPrompt({
                mode: batch.mode,
                tabs: batch.tabs,
                groups: batch.categories,
              }),
              MODEL_RESPONSE_SCHEMA,
              15_000,
            );
            return JSON.parse(text) as unknown;
          },
        }),
      );
    },
    async fallback(task, reason) {
      const input = toOrganizerInput(task);
      return {
        mode: "fallback" as const,
        reason,
        groups: createDomainFallback(input.tabs),
      };
    },
    execute(task, ownerToken, groups) {
      return send<ExecutionSummary>({
        type: "execute-groups",
        windowId: task.windowId,
        taskId: task.taskId,
        ownerToken,
        groups,
      });
    },
    update(state) {
      return send<void>({ type: "update-task-state", state });
    },
    release(state) {
      return send<void>({
        type: "release-task",
        windowId: state.windowId,
        taskId: state.taskId,
        ownerToken: state.ownerToken,
      });
    },
    onState,
  };
}

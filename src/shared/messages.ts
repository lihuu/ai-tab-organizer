import type { PlannedGroup, TaskState } from "./types";

export type OrganizerRequest =
  | { type: "get-task-state"; windowId: number }
  | { type: "prepare-task"; windowId: number; ownerToken: string }
  | { type: "update-task-state"; state: TaskState }
  | {
      type: "execute-groups";
      windowId: number;
      taskId: string;
      ownerToken: string;
      groups: PlannedGroup[];
    }
  | {
      type: "release-task";
      windowId: number;
      taskId: string;
      ownerToken: string;
    };

export type OrganizerResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isOrganizerRequest(value: unknown): value is OrganizerRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (typeof message.type !== "string") return false;

  switch (message.type) {
    case "get-task-state":
      return typeof message.windowId === "number";
    case "prepare-task":
      return (
        typeof message.windowId === "number" &&
        typeof message.ownerToken === "string"
      );
    case "update-task-state":
      return typeof message.state === "object" && message.state !== null;
    case "execute-groups":
      return (
        typeof message.windowId === "number" &&
        typeof message.taskId === "string" &&
        typeof message.ownerToken === "string" &&
        Array.isArray(message.groups)
      );
    case "release-task":
      return (
        typeof message.windowId === "number" &&
        typeof message.taskId === "string" &&
        typeof message.ownerToken === "string"
      );
    default:
      return false;
  }
}

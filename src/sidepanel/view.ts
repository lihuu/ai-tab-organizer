import type { TaskState } from "../shared/types";

export function render(
  state: TaskState,
  elements: { status: HTMLElement; action: HTMLButtonElement },
) {
  const labels: Record<TaskState["phase"], string> = {
    idle: "Checking current window...",
    "needs-setup": "Chrome's local AI is required for first-time use.",
    downloading: `Preparing model... ${Math.round((state.downloadProgress ?? 0) * 100)}%`,
    running: `Organizing batch ${state.currentBatch}/${state.totalBatches}`,
    completed: "AI grouping completed",
    "fallback-completed": "Grouped by domain",
    "no-op": "No tabs to organize",
    failed: "Organization incomplete",
  };
  elements.status.textContent = labels[state.phase];
  elements.action.hidden = state.phase !== "needs-setup";
  elements.action.textContent = "Setup Local AI";
}

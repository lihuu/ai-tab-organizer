import type { TaskState } from "../shared/types";

export function render(
  state: TaskState,
  elements: { status: HTMLElement; action: HTMLButtonElement },
) {
  const labels: Record<TaskState["phase"], string> = {
    idle: "正在检查当前窗口…",
    "needs-setup": "首次使用需要准备 Chrome 本地 AI。",
    downloading: `正在准备模型… ${Math.round((state.downloadProgress ?? 0) * 100)}%`,
    running: `正在整理第 ${state.currentBatch}/${state.totalBatches} 批`,
    completed: "AI 分组完成",
    "fallback-completed": "已按域名完成分组",
    "no-op": "当前没有需要整理的标签",
    failed: "整理未完全成功",
  };
  elements.status.textContent = labels[state.phase];
  elements.action.hidden = state.phase !== "needs-setup";
  elements.action.textContent = "准备本地 AI";
}

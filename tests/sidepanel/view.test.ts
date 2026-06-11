// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "../../src/sidepanel/view";

it.each([
  ["idle", "正在检查"],
  ["needs-setup", "首次使用"],
  ["downloading", "正在准备模型"],
  ["running", "正在整理"],
  ["completed", "AI 分组完成"],
  ["fallback-completed", "已按域名"],
  ["no-op", "没有需要整理"],
  ["failed", "未完全成功"],
] as const)("renders %s", (phase, text) => {
  const status = document.createElement("section");
  const action = document.createElement("button");
  render(
    {
      windowId: 1,
      ownerToken: "owner",
      taskId: "task",
      phase,
      processedTabs: 0,
      totalTabs: 2,
      currentBatch: 1,
      totalBatches: 1,
      updatedAt: 0,
      downloadProgress: 0.5,
    },
    { status, action },
  );
  expect(status.textContent).toContain(text);
  expect(action.hidden).toBe(phase !== "needs-setup");
});

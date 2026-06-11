import { describe, expect, it, vi } from "vitest";
import { SidePanelModel } from "../../src/sidepanel/model";
import type { PanelDependencies, PreparedResponse } from "../../src/sidepanel/model";
import type { PlannedGroup, TaskState } from "../../src/shared/types";

describe("SidePanelModel", () => {
  it("auto-starts when the model is available", async () => {
    const deps = makePanelDeps({ availability: "available" });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(deps.organize).toHaveBeenCalledOnce();
  });

  it("waits for a click when the model is downloadable", async () => {
    const deps = makePanelDeps({ availability: "downloadable" });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(model.state.phase).toBe("needs-setup");
    expect(deps.organize).not.toHaveBeenCalled();
    await model.prepareAndRun();
    expect(deps.organize).toHaveBeenCalledOnce();
  });

  it("uses fallback without a second click when the API is unavailable", async () => {
    const deps = makePanelDeps({ availability: "unavailable" });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(deps.fallback).toHaveBeenCalledOnce();
  });

  it("shows an existing busy task without starting another run", async () => {
    const deps = makePanelDeps({ availability: "available" });
    deps.prepare.mockResolvedValueOnce({
      status: "busy",
      state: {
        ...(await deps.prepare(1, "owner").then((value) => value.state)),
        phase: "running",
      },
    });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(deps.organize).not.toHaveBeenCalled();
    expect(deps.onState).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "running" }),
    );
  });

  it("falls back after model creation or seed classification fails", async () => {
    const deps = makePanelDeps({ availability: "available" });
    deps.organize.mockRejectedValueOnce(new Error("model-create-failed"));
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(deps.fallback).toHaveBeenCalledWith(
      expect.anything(),
      "model-failed",
    );
  });

  it("reports an execution transport failure as failed", async () => {
    const deps = makePanelDeps({ availability: "available" });
    deps.organize.mockResolvedValueOnce({
      mode: "ai",
      groups: [{ title: "Work", tabIds: [1, 2] }],
    });
    deps.execute.mockRejectedValueOnce(new Error("worker-gone"));
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(model.state.phase).toBe("failed");
    expect(model.state.errorCode).toBe("group-execution-failed");
    expect(deps.release).toHaveBeenCalledOnce();
  });
});

function makePanelDeps({
  availability,
}: {
  availability: "available" | "downloadable" | "downloading" | "unavailable";
}) {
  const state: TaskState = {
    windowId: 1,
    ownerToken: "owner",
    taskId: "task",
    phase: "idle",
    processedTabs: 0,
    totalTabs: 2,
    currentBatch: 0,
    totalBatches: 1,
    updatedAt: 0,
  };
  return {
    getWindowId: vi.fn(async () => 1),
    getOwnerToken: vi.fn(() => "owner"),
    prepare: vi.fn<PanelDependencies["prepare"]>(async () => ({
      status: "prepared",
      state,
      task: {
        taskId: "task",
        windowId: 1,
        tabs: [
          { id: 1, windowId: 1, title: "A", url: "https://a.test", pinned: false, groupId: -1 },
          { id: 2, windowId: 1, title: "B", url: "https://b.test", pinned: false, groupId: -1 },
        ],
        existingGroups: [],
      },
    } satisfies PreparedResponse)),
    availability: vi.fn(async () => availability),
    organize: vi.fn<PanelDependencies["organize"]>(async () => ({
      mode: "ai",
      groups: [] as PlannedGroup[],
    })),
    fallback: vi.fn(async () => ({ mode: "fallback" as const, groups: [] as PlannedGroup[], reason: "test" })),
    execute: vi.fn(async () => ({
      groupsCreated: 0,
      groupsReused: 0,
      tabsGrouped: 0,
      tabsSkipped: 0,
      tabsFailed: 0,
    })),
    update: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
    onState: vi.fn(),
  };
}

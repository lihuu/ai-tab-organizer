import type {
  ExecutionSummary,
  PlannedGroup,
  PreparedTask,
  TaskState,
} from "../shared/types";

export type Availability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

export type PreparedResponse =
  | { status: "busy"; state: TaskState }
  | { status: "prepared"; state: TaskState; task: PreparedTask };

export interface OrganizerResult {
  mode: "ai" | "fallback" | "no-op";
  groups: PlannedGroup[];
  reason?: string;
}

export interface PanelDependencies {
  getWindowId(): Promise<number>;
  getOwnerToken(): string;
  prepare(windowId: number, ownerToken: string): Promise<PreparedResponse>;
  availability(): Promise<Availability>;
  organize(
    task: PreparedTask,
    callbacks: {
      onDownload(loaded: number): Promise<void>;
      onProgress(processed: number, batch: number, total: number): Promise<void>;
    },
  ): Promise<OrganizerResult>;
  fallback(task: PreparedTask, reason: string): Promise<OrganizerResult>;
  execute(
    task: PreparedTask,
    ownerToken: string,
    groups: PlannedGroup[],
  ): Promise<ExecutionSummary>;
  update(state: TaskState): Promise<void>;
  release(state: TaskState): Promise<void>;
  onState(state: TaskState): void;
}

export class SidePanelModel {
  state!: TaskState;
  private task?: PreparedTask;
  private readonly ownerToken: string;

  constructor(private readonly deps: PanelDependencies) {
    this.ownerToken = deps.getOwnerToken();
  }

  async initialize(): Promise<void> {
    const windowId = await this.deps.getWindowId();
    const prepared = await this.deps.prepare(windowId, this.ownerToken);
    this.state = prepared.state;
    this.deps.onState(this.state);
    if (prepared.status === "busy") return;
    this.task = prepared.task;
    if (prepared.task.tabs.length < 2) {
      await this.finish("no-op");
      return;
    }

    const availability = await this.deps.availability();
    if (availability === "available") {
      await this.runAi();
    } else if (availability === "unavailable") {
      await this.runFallback("model-unavailable");
    } else {
      await this.transition({ phase: "needs-setup" });
    }
  }

  async prepareAndRun(): Promise<void> {
    if (!this.task || this.state.phase !== "needs-setup") return;
    await this.runAi();
  }

  private async runAi(): Promise<void> {
    if (!this.task) return;
    await this.transition({ phase: "running" });
    try {
      const result = await this.deps.organize(this.task, {
        onDownload: async (loaded) => {
          await this.transition({ phase: "downloading", downloadProgress: loaded });
        },
        onProgress: async (processed, batch, total) => {
          await this.transition({
            phase: "running",
            processedTabs: processed,
            currentBatch: batch,
            totalBatches: total,
          });
        },
      });
      if (result.mode === "fallback") {
        await this.executeAndFinish(
          result.groups,
          "fallback-completed",
          result.reason,
        );
      } else if (result.mode === "no-op") {
        await this.finish("no-op");
      } else {
        await this.executeAndFinish(result.groups, "completed");
      }
    } catch {
      await this.runFallback("model-failed");
    }
  }

  private async runFallback(reason: string): Promise<void> {
    if (!this.task) return;
    const result = await this.deps.fallback(this.task, reason);
    if (result.groups.length === 0) {
      await this.finish("no-op", { fallbackReason: reason });
      return;
    }
    await this.executeAndFinish(
      result.groups,
      "fallback-completed",
      result.reason ?? reason,
    );
  }

  private async executeAndFinish(
    groups: PlannedGroup[],
    phase: "completed" | "fallback-completed",
    fallbackReason?: string,
  ): Promise<void> {
    if (!this.task) return;
    try {
      const summary = await this.deps.execute(
        this.task,
        this.ownerToken,
        groups,
      );
      await this.finish(phase, {
        summary,
        ...(fallbackReason ? { fallbackReason } : {}),
      });
    } catch {
      await this.finish("failed", { errorCode: "group-execution-failed" });
    }
  }

  private async finish(
    phase: TaskState["phase"],
    patch: Partial<TaskState> = {},
  ): Promise<void> {
    await this.transition({ ...patch, phase });
    await this.deps.release(this.state);
  }

  private async transition(patch: Partial<TaskState>): Promise<void> {
    this.state = { ...this.state, ...patch, updatedAt: Date.now() };
    this.deps.onState(this.state);
    await this.deps.update(this.state);
  }
}

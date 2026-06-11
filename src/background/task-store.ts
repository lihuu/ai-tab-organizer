import type { TaskState } from "../shared/types";

interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export class TaskStore {
  constructor(
    private readonly storage: SessionArea = chrome.storage.session as unknown as SessionArea,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 120_000,
  ) {}

  async claim(windowId: number, ownerToken: string, totalTabs: number) {
    const current = await this.get(windowId);
    if (current && this.now() - current.updatedAt <= this.ttlMs) {
      if (current.ownerToken === ownerToken) {
        return { acquired: true as const, state: current };
      }
      return { acquired: false as const, state: current };
    }
    const state: TaskState = {
      windowId,
      ownerToken,
      taskId: crypto.randomUUID(),
      phase: "idle",
      processedTabs: 0,
      totalTabs,
      currentBatch: 0,
      totalBatches: Math.ceil(totalTabs / 50),
      updatedAt: this.now(),
    };
    await this.storage.set({ [this.key(windowId)]: state });
    return { acquired: true as const, state };
  }

  async get(windowId: number): Promise<TaskState | undefined> {
    const result = await this.storage.get(this.key(windowId));
    return result[this.key(windowId)] as TaskState | undefined;
  }

  async update(state: TaskState): Promise<void> {
    await this.storage.set({
      [this.key(state.windowId)]: this.toStoredState({
        ...state,
        updatedAt: this.now(),
      }),
    });
  }

  async release(windowId: number, taskId: string, ownerToken: string) {
    const current = await this.get(windowId);
    if (current?.taskId === taskId && current.ownerToken === ownerToken) {
      await this.storage.remove(this.key(windowId));
    }
  }

  private key(windowId: number) {
    return `task:${windowId}`;
  }

  private toStoredState(state: TaskState): TaskState {
    return {
      windowId: state.windowId,
      ownerToken: state.ownerToken,
      taskId: state.taskId,
      phase: state.phase,
      processedTabs: state.processedTabs,
      totalTabs: state.totalTabs,
      currentBatch: state.currentBatch,
      totalBatches: state.totalBatches,
      updatedAt: state.updatedAt,
      ...(state.downloadProgress !== undefined
        ? { downloadProgress: state.downloadProgress }
        : {}),
      ...(state.fallbackReason ? { fallbackReason: state.fallbackReason } : {}),
      ...(state.summary ? { summary: state.summary } : {}),
      ...(state.errorCode ? { errorCode: state.errorCode } : {}),
    };
  }
}

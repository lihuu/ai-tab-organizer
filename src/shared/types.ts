export type TaskPhase =
  | "idle"
  | "needs-setup"
  | "downloading"
  | "running"
  | "completed"
  | "fallback-completed"
  | "no-op"
  | "failed";

export interface TabSnapshot {
  id: number;
  windowId: number;
  title: string;
  url: string;
  pinned: boolean;
  groupId: number;
}

export interface ExistingGroup {
  id: number;
  title: string;
  color: `${chrome.tabGroups.Color}`;
}

export interface PreparedTask {
  taskId: string;
  windowId: number;
  tabs: TabSnapshot[];
  existingGroups: ExistingGroup[];
}

export interface PlannedGroup {
  title: string;
  tabIds: number[];
  existingGroupId?: number;
}

export interface ExecutionSummary {
  groupsCreated: number;
  groupsReused: number;
  tabsGrouped: number;
  tabsSkipped: number;
  tabsFailed: number;
}

export interface TaskState {
  windowId: number;
  ownerToken: string;
  taskId: string;
  phase: TaskPhase;
  processedTabs: number;
  totalTabs: number;
  currentBatch: number;
  totalBatches: number;
  updatedAt: number;
  downloadProgress?: number;
  fallbackReason?: string;
  summary?: ExecutionSummary;
  errorCode?: string;
}

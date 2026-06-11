import { describe, expect, it } from "vitest";
import { TaskStore } from "../../src/background/task-store";
import { fakeSessionStorage } from "../helpers/fake-chrome";

describe("TaskStore", () => {
  it("allows one owner per window and reclaims an expired lock", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 100_000, 120_000);
    expect(await store.claim(1, "owner-a", 3)).toMatchObject({ acquired: true });
    expect(await store.claim(1, "owner-b", 3)).toMatchObject({ acquired: false });

    const later = new TaskStore(storage, () => 221_000, 120_000);
    expect(await later.claim(1, "owner-b", 3)).toMatchObject({ acquired: true });
  });

  it("never stores tab titles, URLs, prompts, or model output", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 1, 120_000);
    await store.claim(2, "owner", 10);
    expect(JSON.stringify(storage.data)).not.toMatch(/title|url|prompt|output/i);
  });

  it("lets the same owner reclaim the existing task after reload", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 1, 120_000);
    const first = await store.claim(1, "owner", 3);
    const second = await store.claim(1, "owner", 3);
    expect(second).toEqual(first);
  });

  it("does not release another owner or another task", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 1, 120_000);
    const claim = await store.claim(1, "owner", 3);
    await store.release(1, claim.state.taskId, "different-owner");
    expect(await store.get(1)).toEqual(claim.state);
  });

  it("strips sensitive data when updating state", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 1, 120_000);
    const claim = await store.claim(1, "owner", 3);

    // Simulate state with sensitive data added by mistake
    const stateWithSensitive = {
      ...claim.state,
      phase: "running" as const,
      tabTitles: ["Secret Tab 1", "Secret Tab 2"],
    };

    await store.update(stateWithSensitive);
    expect(JSON.stringify(storage.data)).not.toMatch(/secret|tabTitles/i);
  });
});

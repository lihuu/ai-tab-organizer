import { describe, expect, it, vi } from "vitest";
import {
  destroyActiveLanguageModelSession,
  promptWithTimeout,
  withLanguageModel,
} from "../../src/ai/language-model";

describe("withLanguageModel", () => {
  it("destroys the session when work succeeds", async () => {
    const session = { prompt: vi.fn(), destroy: vi.fn() };
    const result = await withLanguageModel(
      { availability: vi.fn().mockResolvedValue("available"), create: vi.fn().mockResolvedValue(session) },
      () => undefined,
      async () => "done",
    );
    expect(result).toBe("done");
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the session when work throws", async () => {
    const session = { prompt: vi.fn(), destroy: vi.fn() };
    await expect(
      withLanguageModel(
        { availability: vi.fn().mockResolvedValue("available"), create: vi.fn().mockResolvedValue(session) },
        () => undefined,
        async () => {
          throw new Error("bad-output");
        },
      ),
    ).rejects.toThrow("bad-output");
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it("rejects unavailable models without creating a session", async () => {
    const api = {
      availability: vi.fn().mockResolvedValue("unavailable"),
      create: vi.fn(),
    };
    await expect(
      withLanguageModel(api, () => undefined, async () => "unused"),
    ).rejects.toThrow("model-unavailable");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("aborts a prompt at the batch deadline", async () => {
    vi.useFakeTimers();
    const session = {
      prompt: vi.fn((_text: string, options?: { signal?: AbortSignal; responseConstraint?: object }) =>
        new Promise<string>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
      ),
      destroy: vi.fn(),
    };
    const pending = promptWithTimeout(session, "input", {}, 15_000);
    // Ensure rejection is caught to avoid unhandled rejection warning
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).rejects.toThrow("batch-timeout");
    vi.useRealTimers();
  });

  it("allows external cleanup without double-destroy", async () => {
    const session = { prompt: vi.fn(), destroy: vi.fn() };
    const api = {
      availability: vi.fn().mockResolvedValue("available"),
      create: vi.fn().mockResolvedValue(session),
    };

    const workPromise = withLanguageModel(api, () => undefined, async () => {
      // Simulate external cleanup while work is pending
      destroyActiveLanguageModelSession();
      return "done";
    });

    await workPromise;
    // Session should be destroyed exactly once (by external cleanup)
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it("propagates non-timeout errors from prompt", async () => {
    const session = {
      prompt: vi.fn().mockRejectedValue(new Error("model-error")),
      destroy: vi.fn(),
    };
    const api = {
      availability: vi.fn().mockResolvedValue("available"),
      create: vi.fn().mockResolvedValue(session),
    };

    await expect(
      withLanguageModel(api, () => undefined, (s) =>
        promptWithTimeout(s, "input", {}, 15_000),
      ),
    ).rejects.toThrow("model-error");

    expect(session.destroy).toHaveBeenCalledOnce();
  });
});

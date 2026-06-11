import { SYSTEM_PROMPT } from "../domain/prompts";

export class ModelUnavailableError extends Error {}
export class ModelTimeoutError extends Error {}
let activeSession: LanguageModelSession | undefined;

export function destroyActiveLanguageModelSession(): void {
  const session = activeSession;
  activeSession = undefined;
  session?.destroy();
}

export async function promptWithTimeout(
  session: LanguageModelSession,
  prompt: string,
  responseConstraint: object,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await session.prompt(prompt, {
      signal: controller.signal,
      responseConstraint,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ModelTimeoutError("batch-timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function withLanguageModel<T>(
  api: LanguageModelStatic,
  onProgress: (loaded: number) => void,
  work: (session: LanguageModelSession) => Promise<T>,
): Promise<T> {
  const availability = await api.availability();
  if (availability === "unavailable") {
    throw new ModelUnavailableError("model-unavailable");
  }
  const session = await api.create({
    initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        onProgress((event as LanguageModelDownloadProgressEvent).loaded);
      });
    },
  });
  activeSession = session;
  try {
    return await work(session);
  } finally {
    if (activeSession === session) {
      destroyActiveLanguageModelSession();
    }
  }
}

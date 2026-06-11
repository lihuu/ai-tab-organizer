type LanguageModelAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number;
}

interface LanguageModelSession {
  prompt(
    input: string,
    options?: {
      signal?: AbortSignal;
      responseConstraint?: object;
    },
  ): Promise<string>;
  destroy(): void;
}

interface LanguageModelCreateOptions {
  initialPrompts?: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  monitor?: (monitor: EventTarget) => void;
  expectedOutputs?: Array<{
    type: "text";
    languages?: string[];
  }>;
}

interface LanguageModelStatic {
  availability(): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare const LanguageModel: LanguageModelStatic;

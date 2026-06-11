export const SYSTEM_PROMPT = [
  "You organize browser tabs locally.",
  "Return only data matching the supplied JSON schema.",
  "Never invent tab aliases.",
  "A tab may appear in at most one group.",
  "Use at most five groups.",
  "Prefer supplied existing groups.",
  "For Chinese pages, use concise Chinese group names when possible.",
].join(" ");

export function buildBatchPrompt(input: {
  mode: "seed" | "continuation";
  tabs: unknown[];
  groups: unknown[];
}): string {
  const instruction =
    input.mode === "seed"
      ? "Create or reuse categories. Every new category needs at least two tabs."
      : "Assign tabs only to the supplied categories. Do not create categories.";
  return `${instruction}\n${JSON.stringify({ tabs: input.tabs, groups: input.groups })}`;
}

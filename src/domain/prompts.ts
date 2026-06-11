export const SYSTEM_PROMPT = [
  "You organize browser tabs into meaningful groups.",
  "Analyze tab titles, URLs, and domains to identify themes and topics.",
  "Create 3-5 distinct categories based on content similarity.",
  "Examples: 'Development Tools', 'Social Media', 'News & Articles', 'Shopping', 'Entertainment', 'Research', 'Work', 'Education'.",
  "Return only data matching the supplied JSON schema.",
  "Never invent tab aliases.",
  "A tab may appear in at most one group.",
  "Use at most five groups.",
  "Prefer supplied existing groups when tabs match their theme.",
  "Always use English for group names.",
  "Every new category needs at least two tabs.",
].join(" ");

export function buildBatchPrompt(input: {
  mode: "seed" | "continuation";
  tabs: unknown[];
  groups: unknown[];
}): string {
  const instruction =
    input.mode === "seed"
      ? [
          "Analyze the tabs and create 3-5 meaningful categories based on their content.",
          "Look at tab titles, URLs, and domains to identify themes.",
          "Group similar tabs together (e.g., all GitHub repos in one group, all search engines in another).",
          "Every new category needs at least two tabs.",
          "If existing groups are provided and tabs match their theme, reuse them.",
        ].join(" ")
      : "Assign tabs only to the supplied categories. Do not create new categories. Match tabs to categories based on content similarity.";

  return `${instruction}\n\nTabs:\n${JSON.stringify(input.tabs, null, 2)}\n\n${
    input.groups.length > 0
      ? `Available categories:\n${JSON.stringify(input.groups, null, 2)}\n\n`
      : ""
  }Return your grouping as a JSON array.`;
}

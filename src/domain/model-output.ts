import { normalizeGroupName } from "./group-name";

export const MODEL_RESPONSE_SCHEMA = {
  type: "array",
  maxItems: 5,
  items: {
    type: "object",
    properties: {
      groupAlias: { type: "string" },
      groupName: { type: "string" },
      tabAliases: { type: "array", items: { type: "string" } },
    },
    required: ["tabAliases"],
    additionalProperties: false,
  },
} as const;

interface RawGroup {
  groupAlias?: string;
  groupName?: string;
  tabAliases: string[];
}

interface ValidationOptions {
  mode: "seed" | "continuation";
  allowedTabAliases: Set<string>;
  existingGroups: Map<string, { title: string }>;
  maxGroups: number;
}

export function validateModelOutput(
  raw: unknown,
  options: ValidationOptions,
) {
  if (!Array.isArray(raw)) return [];
  const usedTabs = new Set<string>();
  const merged = new Map<
    string,
    {
      groupAlias?: string;
      groupName: string;
      tabAliases: string[];
    }
  >();

  for (const item of raw as RawGroup[]) {
    if (!item || typeof item !== "object") continue;
    if (item.tabAliases !== undefined && !Array.isArray(item.tabAliases))
      continue;
    if (!Array.isArray(item.tabAliases)) continue;
    const known = item.groupAlias
      ? options.existingGroups.get(item.groupAlias)
      : undefined;
    if (item.groupAlias && !known) continue;
    if (options.mode === "continuation" && !known) continue;
    const groupName = normalizeGroupName(
      known?.title ?? item.groupName ?? "",
    );
    if (!groupName) continue;
    const key = item.groupAlias
      ? `alias:${item.groupAlias}`
      : `name:${groupName}`;
    const group = merged.get(key) ?? {
      ...(item.groupAlias ? { groupAlias: item.groupAlias } : {}),
      groupName,
      tabAliases: [],
    };
    const tabAliases = item.tabAliases.filter((alias) => {
      if (!options.allowedTabAliases.has(alias) || usedTabs.has(alias))
        return false;
      usedTabs.add(alias);
      return true;
    });
    group.tabAliases.push(...tabAliases);
    merged.set(key, group);
  }

  const minimum = options.mode === "seed" ? 2 : 1;
  return [...merged.values()]
    .filter((group) => group.tabAliases.length >= minimum)
    .slice(0, options.maxGroups);
}

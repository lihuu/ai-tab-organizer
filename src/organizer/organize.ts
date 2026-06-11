import { createBatches } from "../domain/batching";
import { createDomainFallback } from "../domain/fallback";
import { validateModelOutput } from "../domain/model-output";
import type { ExistingGroup, PlannedGroup } from "../shared/types";

export interface OrganizerTab {
  alias: string;
  tabId: number;
  title: string;
  host?: string;
  path?: string;
}

export interface OrganizerInput {
  tabs: OrganizerTab[];
  existingGroups: Array<ExistingGroup & { alias: string }>;
}

export interface OrganizerDependencies {
  classify(input: {
    mode: "seed" | "continuation";
    tabs: OrganizerTab[];
    categories: Array<{ alias: string; title: string; existingGroupId?: number }>;
  }): Promise<unknown>;
  now(): number;
  onProgress?(processed: number, batch: number, totalBatches: number): void;
}

type OrganizerResult =
  | { mode: "no-op"; groups: PlannedGroup[] }
  | { mode: "ai"; groups: PlannedGroup[] }
  | { mode: "fallback"; reason: string; groups: PlannedGroup[] };

export async function organizeTabs(
  input: OrganizerInput,
  deps: OrganizerDependencies,
): Promise<OrganizerResult> {
  if (input.tabs.length < 2) {
    return { mode: "no-op", groups: [] };
  }

  const startedAt = deps.now();
  const batches = createBatches(input.tabs, 50);
  const offeredGroups = input.existingGroups.map((group) => ({
    alias: group.alias,
    title: group.title,
    existingGroupId: group.id,
  }));

  let categories: Category[] = [];
  const assignments = new Map<string, Set<number>>();

  for (let index = 0; index < batches.length; index += 1) {
    if (deps.now() - startedAt >= 60_000) break;
    const batch = batches[index]!;
    const isSeed = index === 0;
    const availableGroups = isSeed ? offeredGroups : categories;

    try {
      const raw = await deps.classify({
        mode: isSeed ? "seed" : "continuation",
        tabs: batch,
        categories: availableGroups,
      });

      const valid = validateModelOutput(raw, {
        mode: isSeed ? "seed" : "continuation",
        allowedTabAliases: new Set(batch.map((tab) => tab.alias)),
        existingGroups: new Map(
          availableGroups.map((group) => [group.alias, group]),
        ),
        maxGroups: 5,
      });

      if (isSeed && valid.length === 0) {
        return fallback(input.tabs, "seed-invalid");
      }

      if (isSeed) {
        categories = establishCategories(valid, offeredGroups);
      }

      mergeAssignments(valid, batch, categories, assignments);

      deps.onProgress?.(
        Math.min((index + 1) * 50, input.tabs.length),
        index + 1,
        batches.length,
      );
    } catch {
      if (isSeed) return fallback(input.tabs, "seed-failed");
      break;
    }
  }

  return {
    mode: "ai",
    groups: toPlans(categories, assignments),
  };
}

type ValidatedGroup = ReturnType<typeof validateModelOutput>[number];
type Category = {
  alias: string;
  title: string;
  existingGroupId?: number;
};

function establishCategories(
  groups: ValidatedGroup[],
  offered: Category[],
): Category[] {
  const byAlias = new Map(offered.map((group) => [group.alias, group]));
  let newIndex = 1;
  return groups.slice(0, 5).map((group) => {
    if (group.groupAlias) return byAlias.get(group.groupAlias)!;
    return { alias: `C${newIndex++}`, title: group.groupName };
  });
}

function mergeAssignments(
  groups: ValidatedGroup[],
  batch: OrganizerTab[],
  categories: Category[],
  assignments: Map<string, Set<number>>,
): void {
  const tabByAlias = new Map(batch.map((tab) => [tab.alias, tab.tabId]));
  const categoryByExistingAlias = new Map(
    categories.map((category) => [category.alias, category]),
  );
  const categoryByName = new Map(
    categories.map((category) => [category.title, category]),
  );

  for (const group of groups) {
    const category = group.groupAlias
      ? categoryByExistingAlias.get(group.groupAlias)
      : categoryByName.get(group.groupName);
    if (!category) continue;
    const ids = assignments.get(category.alias) ?? new Set<number>();
    for (const alias of group.tabAliases) {
      const tabId = tabByAlias.get(alias);
      if (tabId !== undefined) ids.add(tabId);
    }
    assignments.set(category.alias, ids);
  }
}

function toPlans(
  categories: Category[],
  assignments: Map<string, Set<number>>,
): PlannedGroup[] {
  return categories.flatMap((category) => {
    const tabIds = [...(assignments.get(category.alias) ?? [])];
    if (tabIds.length === 0) return [];
    return [
      {
        title: category.title,
        tabIds,
        ...(category.existingGroupId !== undefined
          ? { existingGroupId: category.existingGroupId }
          : {}),
      },
    ];
  });
}

function fallback(
  tabs: OrganizerTab[],
  reason: string,
): { mode: "fallback"; reason: string; groups: PlannedGroup[] } {
  return {
    mode: "fallback",
    reason,
    groups: createDomainFallback(tabs),
  };
}

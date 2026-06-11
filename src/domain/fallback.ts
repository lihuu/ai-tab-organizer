import type { PlannedGroup } from "../shared/types";
import { registrableDomain } from "./batching";
import { normalizeGroupName } from "./group-name";

export function createDomainFallback(
  tabs: Array<{ tabId: number; host?: string }>,
  maxGroups = 5,
): PlannedGroup[] {
  const byDomain = new Map<string, number[]>();
  const seenIds = new Set<number>();
  for (const tab of tabs) {
    if (seenIds.has(tab.tabId)) continue;
    seenIds.add(tab.tabId);
    const domain = registrableDomain(tab.host);
    if (domain === "__internal__") continue;
    const ids = byDomain.get(domain) ?? [];
    ids.push(tab.tabId);
    byDomain.set(domain, ids);
  }

  return [...byDomain.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort(
      (left, right) =>
        right[1].length - left[1].length || left[0].localeCompare(right[0]),
    )
    .slice(0, maxGroups)
    .map(([domain, tabIds]) => ({
      title: normalizeGroupName(domain),
      tabIds,
    }));
}

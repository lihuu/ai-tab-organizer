import { getDomain } from "tldts";

export interface BatchableTab {
  alias: string;
  host?: string;
}

export function registrableDomain(host?: string): string {
  if (!host) return "__internal__";
  return getDomain(host, { allowPrivateDomains: true }) ?? host;
}

export function createBatches<T extends BatchableTab>(
  tabs: T[],
  batchSize = 50,
): T[][] {
  const queues = new Map<string, T[]>();
  for (const tab of tabs) {
    const key = registrableDomain(tab.host);
    const queue = queues.get(key) ?? [];
    queue.push(tab);
    queues.set(key, queue);
  }

  const ordered: T[] = [];
  while ([...queues.values()].some((queue) => queue.length > 0)) {
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (next) ordered.push(next);
    }
  }

  const batches: T[][] = [];
  for (let index = 0; index < ordered.length; index += batchSize) {
    batches.push(ordered.slice(index, index + batchSize));
  }
  return batches;
}

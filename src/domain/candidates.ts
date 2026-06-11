import type { TabSnapshot } from "../shared/types";
import { aliasMap } from "./aliases";
import { sanitizeUrl, type SanitizedLocation } from "./url";

export interface ModelTab {
  alias: string;
  title: string;
  location: SanitizedLocation;
}

const UNGROUPED_TAB_ID = -1;

export function prepareCandidates(tabs: TabSnapshot[]) {
  const candidates = tabs.filter(
    (tab) => !tab.pinned && tab.groupId === UNGROUPED_TAB_ID,
  );
  const aliases = aliasMap("T", candidates.map((tab) => tab.id));

  return {
    items: candidates.map((tab, index) => ({
      alias: aliases.aliasByIndex[index]!,
      title: tab.title,
      location: sanitizeUrl(tab.url),
    })),
    tabIdByAlias: aliases.valueByAlias,
  };
}

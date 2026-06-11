export function aliasMap<T>(
  prefix: "T" | "G",
  values: T[],
): { aliasByIndex: string[]; valueByAlias: Map<string, T> } {
  const aliasByIndex = values.map((_, index) => `${prefix}${index + 1}`);
  return {
    aliasByIndex,
    valueByAlias: new Map(aliasByIndex.map((alias, index) => [alias, values[index]!])),
  };
}

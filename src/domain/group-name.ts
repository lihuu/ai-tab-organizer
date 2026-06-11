const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function normalizeGroupName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const limit = CJK.test(trimmed) ? 4 : 12;
  return [...trimmed].slice(0, limit).join("");
}

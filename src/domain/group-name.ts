const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function normalizeGroupName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  // CJK characters are more compact, allow up to 10 characters
  // Non-CJK can use up to 20 characters
  const limit = CJK.test(trimmed) ? 10 : 20;
  return [...trimmed].slice(0, limit).join("");
}

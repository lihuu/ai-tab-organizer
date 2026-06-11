export type SanitizedLocation =
  | { kind: "web"; host: string; path?: string }
  | { kind: "chrome" | "extension" | "new-tab" | "other" };

export function sanitizeUrl(raw: string): SanitizedLocation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "other" };
  }

  if (url.protocol === "chrome:") {
    return { kind: url.hostname === "newtab" ? "new-tab" : "chrome" };
  }
  if (url.protocol === "chrome-extension:") return { kind: "extension" };
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "other" };
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => {
      try {
        return decodeURIComponent(segment).slice(0, 80);
      } catch {
        return segment.slice(0, 80);
      }
    });
  const path = segments.length > 0 ? `/${segments.join("/")}` : undefined;

  return {
    kind: "web",
    host: url.hostname.toLowerCase(),
    ...(path ? { path } : {}),
  };
}

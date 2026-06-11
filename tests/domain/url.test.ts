import { describe, expect, it } from "vitest";
import { sanitizeUrl } from "../../src/domain/url";

describe("sanitizeUrl", () => {
  it("keeps lowercase host and two path segments while stripping secrets", () => {
    expect(
      sanitizeUrl(
        "https://user:pass@Docs.Example.com/a/b/c?q=secret#token",
      ),
    ).toEqual({
      kind: "web",
      host: "docs.example.com",
      path: "/a/b",
    });
  });

  it("classifies internal pages without returning the URL", () => {
    expect(sanitizeUrl("chrome://settings/privacy")).toEqual({
      kind: "chrome",
    });
    expect(sanitizeUrl("chrome-extension://abc/options.html")).toEqual({
      kind: "extension",
    });
  });
});

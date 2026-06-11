import { describe, expect, it } from "vitest";
import { createDomainFallback } from "../../src/domain/fallback";

describe("createDomainFallback", () => {
  it("groups subdomains by registrable domain and ignores singletons", () => {
    const groups = createDomainFallback([
      { tabId: 1, host: "docs.google.com" },
      { tabId: 2, host: "mail.google.com" },
      { tabId: 3, host: "github.com" },
    ]);
    expect(groups).toEqual([{ title: "google.com", tabIds: [1, 2] }]);
  });

  it("handles PSL domains, duplicate IDs, internal pages, and stable ties", () => {
    expect(
      createDomainFallback([
        { tabId: 1, host: "a.example.co.uk" },
        { tabId: 1, host: "b.example.co.uk" },
        { tabId: 2, host: "b.example.co.uk" },
        { tabId: 3 },
        { tabId: 4, host: "z.test" },
        { tabId: 5, host: "z.test" },
      ]),
    ).toEqual([
      { title: "example.co.u", tabIds: [1, 2] },
      { title: "z.test", tabIds: [4, 5] },
    ]);
  });

  it("limits the result to five groups", () => {
    const tabs = Array.from({ length: 12 }, (_, index) => ({
      tabId: index + 1,
      host: `x${Math.floor(index / 2)}.example${Math.floor(index / 2)}.com`,
    }));
    expect(createDomainFallback(tabs)).toHaveLength(5);
  });
});

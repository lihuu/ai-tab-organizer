import { describe, expect, it } from "vitest";
import { createBatches, registrableDomain } from "../../src/domain/batching";

describe("createBatches", () => {
  it("round-robins registrable domains in the first batch", () => {
    const tabs = [
      { alias: "T1", host: "docs.google.com" },
      { alias: "T2", host: "mail.google.com" },
      { alias: "T3", host: "github.com" },
      { alias: "T4", host: "jira.example.co.uk" },
    ];

    expect(createBatches(tabs, 3)[0]!.map((tab) => tab.alias)).toEqual([
      "T1",
      "T3",
      "T4",
    ]);
  });

  it("returns every input exactly once across batches", () => {
    const tabs = Array.from({ length: 103 }, (_, index) => ({
      alias: `T${index + 1}`,
      host: `${index % 4}.example.com`,
    }));
    const batches = createBatches(tabs, 50);
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 3]);
    expect(new Set(batches.flat().map((tab) => tab.alias)).size).toBe(103);
  });
});

describe("registrableDomain", () => {
  it.each([
    ["jira.example.co.uk", "example.co.uk"],
    ["team.blogspot.com", "team.blogspot.com"],
    ["127.0.0.1", "127.0.0.1"],
    ["localhost", "localhost"],
    [undefined, "__internal__"],
  ])("maps %s to %s", (host, expected) => {
    expect(registrableDomain(host)).toBe(expected);
  });
});

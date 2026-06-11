import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("build output", () => {
  it("contains loadable extension entry points", async () => {
    await Promise.all([
      access("dist/manifest.json"),
      access("dist/background.js"),
      access("dist/sidepanel.html"),
    ]);
    const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
    expect(manifest.background.service_worker).toBe("background.js");
  });
});

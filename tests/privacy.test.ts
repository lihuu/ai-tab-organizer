import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("privacy contract", () => {
  it("declares no host permissions or remote code", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    expect(manifest.host_permissions).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toMatch(/https?:\/\//);
    expect(manifest.content_security_policy).toBeUndefined();
  });
});

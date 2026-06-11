import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("manifest", () => {
  it("uses MV3, Chrome 138, minimum permissions, Side Panel, and the shortcut", async () => {
    const raw = await readFile("public/manifest.json", "utf8");
    const manifest = JSON.parse(raw);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe("138");
    expect(manifest.permissions.sort()).toEqual(
      ["sidePanel", "storage", "tabGroups", "tabs"].sort(),
    );
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.side_panel.default_path).toBe("sidepanel.html");
    expect(manifest.commands["organize-tabs"].suggested_key.default).toBe(
      "Alt+Shift+G",
    );
  });
});

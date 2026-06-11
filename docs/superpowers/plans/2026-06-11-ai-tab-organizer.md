# AI Tab Organizer V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that locally classifies ungrouped tabs with Chrome's `LanguageModel`, creates at most five tab groups, and falls back to deterministic registrable-domain grouping.

**Architecture:** A native TypeScript Side Panel owns the Gemini Nano session and batch orchestration. An MV3 service worker owns per-window task metadata, Chrome Tabs/TabGroups calls, and best-effort execution; pure modules implement normalization, batching, validation, and fallback so they can be tested without Chrome.

**Tech Stack:** TypeScript, Vite, Vitest, `@types/chrome`, `tldts`, Chrome MV3 Tabs/TabGroups/SidePanel/Storage APIs, Chrome Prompt API (`LanguageModel`)

---

## File Map

### Build and extension shell

- `package.json`: scripts and pinned development/runtime dependencies.
- `tsconfig.json`: strict TypeScript configuration.
- `vite.config.ts`: multi-entry extension build with stable background filename.
- `vitest.config.ts`: unit/integration test environment.
- `public/manifest.json`: MV3 permissions, Side Panel, service worker, and shortcut.
- `sidepanel.html`: Side Panel document entry.
- `src/sidepanel/styles.css`: minimal state-oriented UI styles.

### Shared contracts

- `src/shared/types.ts`: tab snapshots, group plans, task states, and result types.
- `src/shared/messages.ts`: typed runtime message protocol and response helpers.
- `src/types/chrome-ai.d.ts`: minimal Prompt API declarations not supplied by TypeScript.

### Pure domain logic

- `src/domain/url.ts`: strict URL sanitization and internal-page classification.
- `src/domain/aliases.ts`: `T1`/`G1` aliases without exposing Chrome IDs to AI.
- `src/domain/candidates.ts`: candidate filtering and model-input conversion.
- `src/domain/batching.ts`: registrable-domain round-robin seed selection and 50-tab batches.
- `src/domain/group-name.ts`: Unicode-aware group-name normalization.
- `src/domain/model-output.ts`: JSON schema plus local seed/continuation validation.
- `src/domain/fallback.ts`: registrable-domain fallback grouping.
- `src/domain/prompts.ts`: English system and batch prompts.

### AI and orchestration

- `src/ai/language-model.ts`: availability, download, prompt timeout, and guaranteed destroy.
- `src/organizer/organize.ts`: first-batch category creation, continuation assignment, partial results, and fallback decisions.

### Chrome integration

- `src/background/task-store.ts`: `chrome.storage.session` metadata-only window lock and task state.
- `src/background/tab-source.ts`: current-window candidate and existing-group queries.
- `src/background/group-executor.ts`: revalidation, group reuse/create, color assignment, and best-effort counts.
- `src/background/index.ts`: Side Panel setup, shortcut handling, and message routing.

### Side Panel

- `src/sidepanel/model.ts`: Side Panel controller and task lifecycle.
- `src/sidepanel/view.ts`: state-to-DOM rendering.
- `src/sidepanel/index.ts`: bootstrap and user-event wiring.

### Tests and documentation

- `tests/**/*.test.ts`: colocated-by-feature Vitest suites.
- `tests/helpers/fake-chrome.ts`: explicit Chrome API fake.
- `README.md`: local development, unpacked installation, privacy, and manual acceptance.
- `docs/manual-test-checklist.md`: Chrome 138+ acceptance matrix.

## Delivery Sequence

The tasks deliberately produce independently testable layers:

1. Build shell.
2. Shared protocol.
3. Input privacy and aliases.
4. Batch planning.
5. Output validation.
6. Domain fallback.
7. Prompt API adapter.
8. Organizer.
9. Task store and tab source.
10. Group executor and service worker.
11. Side Panel.
12. End-to-end verification and documentation.

## Explicitly Out of Scope

Do not implement the simulated progress tab group in V1. Chrome groups require real
tabs, so the click-to-run experience using a temporary extension tab remains the
separate interaction experiment documented in design section 13. Do not add a
temporary tab, focus changes, or cleanup machinery while executing this plan.

---

### Task 1: Scaffold the TypeScript MV3 Extension

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `public/manifest.json`
- Create: `sidepanel.html`
- Create: `src/background/index.ts`
- Create: `src/sidepanel/index.ts`
- Create: `src/sidepanel/styles.css`
- Create: `tests/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest contract test**

```ts
// tests/manifest.test.ts
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
```

- [ ] **Step 2: Add the toolchain and run the test to verify the shell is incomplete**

```json
// package.json
{
  "name": "ai-tab-organizer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "check": "tsc --noEmit",
    "test": "vitest run --exclude tests/build-output.test.ts",
    "test:watch": "vitest",
    "verify": "npm run check && npm run test && npm run build"
  },
  "dependencies": {
    "tldts": "^7.0.14"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.3",
    "@types/node": "^24.0.0",
    "jsdom": "^26.1.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "types": ["chrome", "node", "vitest/globals"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

Run: `npm test -- tests/manifest.test.ts`

Expected: FAIL because `public/manifest.json` does not exist.

- [ ] **Step 3: Add the manifest, build configuration, and minimal entries**

```json
// public/manifest.json
{
  "manifest_version": 3,
  "name": "AI Tab Organizer",
  "version": "0.1.0",
  "description": "Group tabs locally with Chrome's built-in AI.",
  "minimum_chrome_version": "138",
  "permissions": ["tabs", "tabGroups", "sidePanel", "storage"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_title": "Organize tabs"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "commands": {
    "organize-tabs": {
      "suggested_key": {
        "default": "Alt+Shift+G"
      },
      "description": "Organize tabs in the current window"
    }
  }
}
```

```ts
// vite.config.ts
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(rootDir, "sidepanel.html"),
        background: resolve(rootDir, "src/background/index.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

```html
<!-- sidepanel.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Tab Organizer</title>
  </head>
  <body>
    <main id="app">正在加载...</main>
    <script type="module" src="/src/sidepanel/index.ts"></script>
  </body>
</html>
```

```ts
// src/background/index.ts
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

```ts
// src/sidepanel/index.ts
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (app) app.textContent = "AI Tab Organizer";
```

```css
/* src/sidepanel/styles.css */
:root {
  font-family: system-ui, sans-serif;
  color: #172033;
  background: #f7f8fb;
}

body {
  margin: 0;
}

#app {
  padding: 20px;
}
```

- [ ] **Step 4: Verify the shell**

Run: `npm run verify`

Expected: type check, one manifest test, and production build all PASS; `dist/manifest.json`, `dist/background.js`, and `dist/sidepanel.html` exist.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts public sidepanel.html src tests
git commit -m "chore: scaffold MV3 extension"
```

---

### Task 2: Define Shared Types and the Runtime Message Protocol

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`
- Create: `src/types/chrome-ai.d.ts`
- Create: `tests/shared/messages.test.ts`

- [ ] **Step 1: Write failing protocol guard tests**

```ts
// tests/shared/messages.test.ts
import { describe, expect, it } from "vitest";
import { isOrganizerRequest } from "../../src/shared/messages";

describe("isOrganizerRequest", () => {
  it("accepts known messages and rejects malformed input", () => {
    expect(
      isOrganizerRequest({
        type: "prepare-task",
        windowId: 7,
        ownerToken: "panel-1",
      }),
    ).toBe(true);
    expect(isOrganizerRequest({ type: "prepare-task", windowId: "7" })).toBe(
      false,
    );
    expect(isOrganizerRequest({ type: "unknown" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/shared/messages.test.ts`

Expected: FAIL because `src/shared/messages.ts` does not exist.

- [ ] **Step 3: Add stable domain types, Prompt API declarations, and protocol guards**

```ts
// src/shared/types.ts
export type TaskPhase =
  | "idle"
  | "needs-setup"
  | "downloading"
  | "running"
  | "completed"
  | "fallback-completed"
  | "no-op"
  | "failed";

export interface TabSnapshot {
  id: number;
  windowId: number;
  title: string;
  url: string;
  pinned: boolean;
  groupId: number;
}

export interface ExistingGroup {
  id: number;
  title: string;
  color: chrome.tabGroups.ColorEnum;
}

export interface PreparedTask {
  taskId: string;
  windowId: number;
  tabs: TabSnapshot[];
  existingGroups: ExistingGroup[];
}

export interface PlannedGroup {
  title: string;
  tabIds: number[];
  existingGroupId?: number;
}

export interface ExecutionSummary {
  groupsCreated: number;
  groupsReused: number;
  tabsGrouped: number;
  tabsSkipped: number;
  tabsFailed: number;
}

export interface TaskState {
  windowId: number;
  ownerToken: string;
  taskId: string;
  phase: TaskPhase;
  processedTabs: number;
  totalTabs: number;
  currentBatch: number;
  totalBatches: number;
  updatedAt: number;
  downloadProgress?: number;
  fallbackReason?: string;
  summary?: ExecutionSummary;
  errorCode?: string;
}
```

```ts
// src/shared/messages.ts
import type { PlannedGroup, TaskState } from "./types";

export type OrganizerRequest =
  | { type: "get-task-state"; windowId: number }
  | { type: "prepare-task"; windowId: number; ownerToken: string }
  | { type: "update-task-state"; state: TaskState }
  | {
      type: "execute-groups";
      windowId: number;
      taskId: string;
      ownerToken: string;
      groups: PlannedGroup[];
    }
  | {
      type: "release-task";
      windowId: number;
      taskId: string;
      ownerToken: string;
    };

export type OrganizerResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isOrganizerRequest(value: unknown): value is OrganizerRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (typeof message.type !== "string") return false;

  switch (message.type) {
    case "get-task-state":
      return typeof message.windowId === "number";
    case "prepare-task":
      return (
        typeof message.windowId === "number" &&
        typeof message.ownerToken === "string"
      );
    case "update-task-state":
      return typeof message.state === "object" && message.state !== null;
    case "execute-groups":
      return (
        typeof message.windowId === "number" &&
        typeof message.taskId === "string" &&
        typeof message.ownerToken === "string" &&
        Array.isArray(message.groups)
      );
    case "release-task":
      return (
        typeof message.windowId === "number" &&
        typeof message.taskId === "string" &&
        typeof message.ownerToken === "string"
      );
    default:
      return false;
  }
}
```

```ts
// src/types/chrome-ai.d.ts
type LanguageModelAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number;
}

interface LanguageModelSession {
  prompt(
    input: string,
    options?: { signal?: AbortSignal; responseConstraint?: object },
  ): Promise<string>;
  destroy(): void;
}

interface LanguageModelCreateOptions {
  initialPrompts?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  monitor?: (monitor: EventTarget) => void;
}

interface LanguageModelStatic {
  availability(): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare const LanguageModel: LanguageModelStatic;
```

- [ ] **Step 4: Run tests and type checking**

Run: `npm run check && npm test -- tests/shared/messages.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/types tests/shared
git commit -m "feat: define organizer contracts"
```

---

### Task 3: Normalize Private Input and Create AI Aliases

**Files:**
- Create: `src/domain/url.ts`
- Create: `src/domain/aliases.ts`
- Create: `src/domain/candidates.ts`
- Create: `tests/domain/url.test.ts`
- Create: `tests/domain/candidates.test.ts`

- [ ] **Step 1: Write failing privacy and candidate tests**

```ts
// tests/domain/url.test.ts
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
```

```ts
// tests/domain/candidates.test.ts
import { describe, expect, it } from "vitest";
import { prepareCandidates } from "../../src/domain/candidates";

describe("prepareCandidates", () => {
  it("excludes pinned and grouped tabs and exposes aliases instead of tab IDs", () => {
    const result = prepareCandidates([
      { id: 91, windowId: 1, title: "A", url: "https://a.test/x", pinned: false, groupId: -1 },
      { id: 92, windowId: 1, title: "B", url: "https://b.test", pinned: true, groupId: -1 },
      { id: 93, windowId: 1, title: "C", url: "https://c.test", pinned: false, groupId: 4 },
    ]);

    expect(result.items).toEqual([
      {
        alias: "T1",
        title: "A",
        location: { kind: "web", host: "a.test", path: "/x" },
      },
    ]);
    expect(result.tabIdByAlias.get("T1")).toBe(91);
    expect(JSON.stringify(result.items)).not.toContain("91");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/url.test.ts tests/domain/candidates.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement strict sanitization, aliases, and filtering**

```ts
// src/domain/url.ts
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
```

```ts
// src/domain/aliases.ts
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
```

```ts
// src/domain/candidates.ts
import type { TabSnapshot } from "../shared/types";
import { aliasMap } from "./aliases";
import { sanitizeUrl, type SanitizedLocation } from "./url";

export interface ModelTab {
  alias: string;
  title: string;
  location: SanitizedLocation;
}

const UNGROUPED_TAB_ID = -1;

export function prepareCandidates(tabs: TabSnapshot[]) {
  const candidates = tabs.filter(
    (tab) => !tab.pinned && tab.groupId === UNGROUPED_TAB_ID,
  );
  const aliases = aliasMap("T", candidates.map((tab) => tab.id));

  return {
    items: candidates.map((tab, index) => ({
      alias: aliases.aliasByIndex[index]!,
      title: tab.title,
      location: sanitizeUrl(tab.url),
    })),
    tabIdByAlias: aliases.valueByAlias,
  };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm run check && npm test -- tests/domain/url.test.ts tests/domain/candidates.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain tests/domain
git commit -m "feat: sanitize tab input for local AI"
```

---

### Task 4: Plan Domain-Diverse Batches

**Files:**
- Create: `src/domain/batching.ts`
- Create: `tests/domain/batching.test.ts`

- [ ] **Step 1: Write failing round-robin and batching tests**

```ts
// tests/domain/batching.test.ts
import { describe, expect, it } from "vitest";
import { createBatches } from "../../src/domain/batching";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/domain/batching.test.ts`

Expected: FAIL because `createBatches` is missing.

- [ ] **Step 3: Implement offline PSL grouping and stable round-robin selection**

```ts
// src/domain/batching.ts
import { getDomain } from "tldts";

export interface BatchableTab {
  alias: string;
  host?: string;
}

export function registrableDomain(host?: string): string {
  if (!host) return "__internal__";
  return getDomain(host, { allowPrivateDomains: true }) ?? host;
}

export function createBatches<T extends BatchableTab>(
  tabs: T[],
  batchSize = 50,
): T[][] {
  const queues = new Map<string, T[]>();
  for (const tab of tabs) {
    const key = registrableDomain(tab.host);
    const queue = queues.get(key) ?? [];
    queue.push(tab);
    queues.set(key, queue);
  }

  const ordered: T[] = [];
  while ([...queues.values()].some((queue) => queue.length > 0)) {
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (next) ordered.push(next);
    }
  }

  const batches: T[][] = [];
  for (let index = 0; index < ordered.length; index += batchSize) {
    batches.push(ordered.slice(index, index + batchSize));
  }
  return batches;
}
```

- [ ] **Step 4: Verify batching and PSL behavior**

Append these assertions:

```ts
it.each([
  ["jira.example.co.uk", "example.co.uk"],
  ["team.blogspot.com", "team.blogspot.com"],
  ["127.0.0.1", "127.0.0.1"],
  ["localhost", "localhost"],
  [undefined, "__internal__"],
])("maps %s to %s", (host, expected) => {
  expect(registrableDomain(host)).toBe(expected);
});
```

Run: `npm run check && npm test -- tests/domain/batching.test.ts`

Expected: PASS with no runtime network access.

- [ ] **Step 5: Commit**

```bash
git add src/domain/batching.ts tests/domain/batching.test.ts
git commit -m "feat: plan domain-diverse AI batches"
```

---

### Task 5: Validate Structured Model Output

**Files:**
- Create: `src/domain/group-name.ts`
- Create: `src/domain/model-output.ts`
- Create: `tests/domain/model-output.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
// tests/domain/model-output.test.ts
import { describe, expect, it } from "vitest";
import { validateModelOutput } from "../../src/domain/model-output";

describe("validateModelOutput", () => {
  it("filters unknown aliases, de-duplicates tabs, and truncates names", () => {
    const output = validateModelOutput(
      [
        { groupName: "技术资料中心", tabAliases: ["T1", "T2", "T404"] },
        { groupName: "ResearchMaterial", tabAliases: ["T2", "T3"] },
      ],
      {
        mode: "seed",
        allowedTabAliases: new Set(["T1", "T2", "T3"]),
        existingGroups: new Map(),
        maxGroups: 5,
      },
    );

    expect(output).toEqual([
      { groupName: "技术资料", tabAliases: ["T1", "T2"] },
    ]);
  });

  it("allows a singleton continuation assignment to an established category", () => {
    const output = validateModelOutput(
      [{ groupAlias: "C1", tabAliases: ["T9"] }],
      {
        mode: "continuation",
        allowedTabAliases: new Set(["T9"]),
        existingGroups: new Map([["C1", { title: "Research" }]]),
        maxGroups: 5,
      },
    );
    expect(output).toEqual([
      { groupAlias: "C1", groupName: "Research", tabAliases: ["T9"] },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/domain/model-output.test.ts`

Expected: FAIL because validation is not implemented.

- [ ] **Step 3: Implement Unicode-aware names, schema, and mode-aware validation**

```ts
// src/domain/group-name.ts
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function normalizeGroupName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const limit = CJK.test(trimmed) ? 4 : 12;
  return [...trimmed].slice(0, limit).join("");
}
```

```ts
// src/domain/model-output.ts
import { normalizeGroupName } from "./group-name";

export const MODEL_RESPONSE_SCHEMA = {
  type: "array",
  maxItems: 5,
  items: {
    type: "object",
    properties: {
      groupAlias: { type: "string" },
      groupName: { type: "string" },
      tabAliases: { type: "array", items: { type: "string" } },
    },
    required: ["tabAliases"],
    additionalProperties: false,
  },
} as const;

interface RawGroup {
  groupAlias?: string;
  groupName?: string;
  tabAliases?: string[];
}

interface ValidationOptions {
  mode: "seed" | "continuation";
  allowedTabAliases: Set<string>;
  existingGroups: Map<string, { title: string }>;
  maxGroups: number;
}

export function validateModelOutput(
  raw: unknown,
  options: ValidationOptions,
) {
  if (!Array.isArray(raw)) return [];
  const usedTabs = new Set<string>();
  const merged = new Map<string, {
    groupAlias?: string;
    groupName: string;
    tabAliases: string[];
  }>();

  for (const item of raw as RawGroup[]) {
    const known = item.groupAlias
      ? options.existingGroups.get(item.groupAlias)
      : undefined;
    if (item.groupAlias && !known) continue;
    if (options.mode === "continuation" && !known) continue;
    const groupName = normalizeGroupName(known?.title ?? item.groupName ?? "");
    if (!groupName) continue;
    const key = item.groupAlias ? `alias:${item.groupAlias}` : `name:${groupName}`;
    const group = merged.get(key) ?? {
      ...(item.groupAlias ? { groupAlias: item.groupAlias } : {}),
      groupName,
      tabAliases: [],
    };
    const tabAliases = (item.tabAliases ?? []).filter((alias) => {
      if (!options.allowedTabAliases.has(alias) || usedTabs.has(alias)) return false;
      usedTabs.add(alias);
      return true;
    });
    group.tabAliases.push(...tabAliases);
    merged.set(key, group);
  }

  const minimum = options.mode === "seed" ? 2 : 1;
  return [...merged.values()]
    .filter((group) => group.tabAliases.length >= minimum)
    .slice(0, options.maxGroups);
}
```

- [ ] **Step 4: Add edge cases and run tests**

Append these cases:

```ts
it("rejects malformed values and seed singletons", () => {
  const options = {
    mode: "seed" as const,
    allowedTabAliases: new Set(["T1"]),
    existingGroups: new Map<string, { title: string }>(),
    maxGroups: 5,
  };
  expect(validateModelOutput("bad", options)).toEqual([]);
  expect(
    validateModelOutput(
      [{ groupName: "Solo", tabAliases: ["T1"] }],
      options,
    ),
  ).toEqual([]);
});

it("merges duplicate normalized names before applying the minimum", () => {
  const result = validateModelOutput(
    [
      { groupName: "研究", tabAliases: ["T1"] },
      { groupName: "  研究  ", tabAliases: ["T2"] },
    ],
    {
      mode: "seed",
      allowedTabAliases: new Set(["T1", "T2"]),
      existingGroups: new Map(),
      maxGroups: 5,
    },
  );
  expect(result).toEqual([
    { groupName: "研究", tabAliases: ["T1", "T2"] },
  ]);
});

it("ignores unknown aliases and caps valid groups at five", () => {
  const raw = Array.from({ length: 6 }, (_, index) => ({
    groupName: `Group ${index}`,
    tabAliases: [`T${index * 2 + 1}`, `T${index * 2 + 2}`],
  }));
  expect(
    validateModelOutput(raw, {
      mode: "seed",
      allowedTabAliases: new Set(Array.from({ length: 12 }, (_, i) => `T${i + 1}`)),
      existingGroups: new Map([["G1", { title: "既存分類" }]]),
      maxGroups: 5,
    }),
  ).toHaveLength(5);
  expect(
    validateModelOutput(
      [{ groupAlias: "G404", tabAliases: ["T1", "T2"] }],
      {
        mode: "seed",
        allowedTabAliases: new Set(["T1", "T2"]),
        existingGroups: new Map(),
        maxGroups: 5,
      },
    ),
  ).toEqual([]);
});
```

Run: `npm run check && npm test -- tests/domain/model-output.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/group-name.ts src/domain/model-output.ts tests/domain/model-output.test.ts
git commit -m "feat: validate structured AI grouping output"
```

---

### Task 6: Implement Registrable-Domain Fallback

**Files:**
- Create: `src/domain/fallback.ts`
- Create: `tests/domain/fallback.test.ts`

- [ ] **Step 1: Write failing fallback tests**

```ts
// tests/domain/fallback.test.ts
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

  it("limits the result to five groups", () => {
    const tabs = Array.from({ length: 12 }, (_, index) => ({
      tabId: index + 1,
      host: `x${Math.floor(index / 2)}.example${Math.floor(index / 2)}.com`,
    }));
    expect(createDomainFallback(tabs)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/fallback.test.ts`

Expected: FAIL because fallback is missing.

- [ ] **Step 3: Implement deterministic fallback**

```ts
// src/domain/fallback.ts
import type { PlannedGroup } from "../shared/types";
import { registrableDomain } from "./batching";
import { normalizeGroupName } from "./group-name";

export function createDomainFallback(
  tabs: Array<{ tabId: number; host?: string }>,
  maxGroups = 5,
): PlannedGroup[] {
  const byDomain = new Map<string, number[]>();
  const seenIds = new Set<number>();
  for (const tab of tabs) {
    if (seenIds.has(tab.tabId)) continue;
    seenIds.add(tab.tabId);
    const domain = registrableDomain(tab.host);
    if (domain === "__internal__") continue;
    const ids = byDomain.get(domain) ?? [];
    ids.push(tab.tabId);
    byDomain.set(domain, ids);
  }

  return [...byDomain.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .slice(0, maxGroups)
    .map(([domain, tabIds]) => ({
      title: normalizeGroupName(domain),
      tabIds,
    }));
}
```

- [ ] **Step 4: Verify fallback edge cases**

Append these cases:

```ts
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
```

Run: `npm run check && npm test -- tests/domain/fallback.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fallback.ts tests/domain/fallback.test.ts
git commit -m "feat: add registrable-domain fallback"
```

---

### Task 7: Wrap the Chrome Prompt API Safely

**Files:**
- Create: `src/domain/prompts.ts`
- Create: `src/ai/language-model.ts`
- Create: `tests/ai/language-model.test.ts`
- Create: `tests/domain/prompts.test.ts`

- [ ] **Step 1: Write failing timeout, download, and destroy tests**

```ts
// tests/ai/language-model.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  promptWithTimeout,
  withLanguageModel,
} from "../../src/ai/language-model";

describe("withLanguageModel", () => {
  it("destroys the session when work succeeds", async () => {
    const session = { prompt: vi.fn(), destroy: vi.fn() };
    const result = await withLanguageModel(
      { availability: vi.fn().mockResolvedValue("available"), create: vi.fn().mockResolvedValue(session) },
      () => undefined,
      async () => "done",
    );
    expect(result).toBe("done");
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the session when work throws", async () => {
    const session = { prompt: vi.fn(), destroy: vi.fn() };
    await expect(
      withLanguageModel(
        { availability: vi.fn().mockResolvedValue("available"), create: vi.fn().mockResolvedValue(session) },
        () => undefined,
        async () => {
          throw new Error("bad-output");
        },
      ),
    ).rejects.toThrow("bad-output");
    expect(session.destroy).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ai/language-model.test.ts tests/domain/prompts.test.ts`

Expected: FAIL because the adapter and prompts do not exist.

- [ ] **Step 3: Implement English prompts, availability mapping, progress, timeout, and destroy**

```ts
// src/domain/prompts.ts
export const SYSTEM_PROMPT = [
  "You organize browser tabs locally.",
  "Return only data matching the supplied JSON schema.",
  "Never invent tab aliases.",
  "A tab may appear in at most one group.",
  "Use at most five groups.",
  "Prefer supplied existing groups.",
  "For Chinese pages, use concise Chinese group names when possible.",
].join(" ");

export function buildBatchPrompt(input: {
  mode: "seed" | "continuation";
  tabs: unknown[];
  groups: unknown[];
}): string {
  const instruction =
    input.mode === "seed"
      ? "Create or reuse categories. Every new category needs at least two tabs."
      : "Assign tabs only to the supplied categories. Do not create categories.";
  return `${instruction}\n${JSON.stringify({ tabs: input.tabs, groups: input.groups })}`;
}
```

```ts
// src/ai/language-model.ts
import { SYSTEM_PROMPT } from "../domain/prompts";

export class ModelUnavailableError extends Error {}
export class ModelTimeoutError extends Error {}
let activeSession: LanguageModelSession | undefined;

export function destroyActiveLanguageModelSession(): void {
  const session = activeSession;
  activeSession = undefined;
  session?.destroy();
}

export async function promptWithTimeout(
  session: LanguageModelSession,
  prompt: string,
  responseConstraint: object,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await session.prompt(prompt, {
      signal: controller.signal,
      responseConstraint,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ModelTimeoutError("batch-timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function withLanguageModel<T>(
  api: LanguageModelStatic,
  onProgress: (loaded: number) => void,
  work: (session: LanguageModelSession) => Promise<T>,
): Promise<T> {
  const availability = await api.availability();
  if (availability === "unavailable") {
    throw new ModelUnavailableError("model-unavailable");
  }
  const session = await api.create({
    initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        onProgress((event as LanguageModelDownloadProgressEvent).loaded);
      });
    },
  });
  activeSession = session;
  try {
    return await work(session);
  } finally {
    if (activeSession === session) {
      destroyActiveLanguageModelSession();
    }
  }
}
```

- [ ] **Step 4: Expand tests and verify**

Append these focused cases:

```ts
it("rejects unavailable models without creating a session", async () => {
  const api = {
    availability: vi.fn().mockResolvedValue("unavailable"),
    create: vi.fn(),
  };
  await expect(
    withLanguageModel(api, () => undefined, async () => "unused"),
  ).rejects.toThrow("model-unavailable");
  expect(api.create).not.toHaveBeenCalled();
});

it("aborts a prompt at the batch deadline", async () => {
  vi.useFakeTimers();
  const session = {
    prompt: vi.fn((_text, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
    ),
    destroy: vi.fn(),
  };
  const pending = promptWithTimeout(session, "input", {}, 15_000);
  await vi.advanceTimersByTimeAsync(15_000);
  await expect(pending).rejects.toThrow("batch-timeout");
  vi.useRealTimers();
});
```

```ts
// tests/domain/prompts.test.ts
import { describe, expect, it } from "vitest";
import { buildBatchPrompt, SYSTEM_PROMPT } from "../../src/domain/prompts";

describe("prompts", () => {
  it("uses English constraints and preserves Chinese metadata", () => {
    expect(SYSTEM_PROMPT).toContain("Return only data");
    expect(
      buildBatchPrompt({
        mode: "seed",
        tabs: [{ alias: "T1", title: "接口文档" }],
        groups: [],
      }),
    ).toContain("接口文档");
  });

  it("forbids new categories in continuation mode", () => {
    expect(
      buildBatchPrompt({ mode: "continuation", tabs: [], groups: [] }),
    ).toContain("Do not create categories");
  });
});
```

Run: `npm run check && npm test -- tests/ai tests/domain/prompts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai src/domain/prompts.ts tests/ai tests/domain/prompts.test.ts
git commit -m "feat: wrap Chrome local language model"
```

---

### Task 8: Orchestrate Seed, Continuation, Partial Results, and Fallback

**Files:**
- Create: `src/organizer/organize.ts`
- Create: `tests/organizer/organize.test.ts`

- [ ] **Step 1: Write failing orchestration tests**

```ts
// tests/organizer/organize.test.ts
import { describe, expect, it, vi } from "vitest";
import { organizeTabs } from "../../src/organizer/organize";

describe("organizeTabs", () => {
  it("falls back when the seed batch has no valid groups", async () => {
    const result = await organizeTabs(makeInput(4), {
      classify: vi.fn().mockResolvedValue([]),
      now: () => 0,
    });
    expect(result.mode).toBe("fallback");
  });

  it("keeps valid seed results when a continuation batch fails", async () => {
    const classify = vi
      .fn()
      .mockResolvedValueOnce([
        { groupName: "Research", tabAliases: ["T1", "T2"] },
      ])
      .mockRejectedValueOnce(new Error("batch-timeout"));
    const result = await organizeTabs(makeInput(51), { classify, now: () => 0 });
    expect(result.mode).toBe("ai");
    expect(result.groups[0]!.tabIds).toEqual([1, 2]);
  });
});
```

The test helper `makeInput(count)` creates candidate tabs with IDs `1..count`,
sanitized hosts, and no existing groups:

```ts
function makeInput(count: number) {
  return {
    tabs: Array.from({ length: count }, (_, index) => ({
      alias: `T${index + 1}`,
      tabId: index + 1,
      title: `Tab ${index + 1}`,
      host: `topic${index % 6}.example${index % 6}.com`,
    })),
    existingGroups: [],
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/organizer/organize.test.ts`

Expected: FAIL because the organizer is missing.

- [ ] **Step 3: Implement the organizer with injected classification**

```ts
// src/organizer/organize.ts
import { createBatches } from "../domain/batching";
import { createDomainFallback } from "../domain/fallback";
import { validateModelOutput } from "../domain/model-output";
import type { ExistingGroup, PlannedGroup } from "../shared/types";

export interface OrganizerTab {
  alias: string;
  tabId: number;
  title: string;
  host?: string;
  path?: string;
}

interface OrganizerInput {
  tabs: OrganizerTab[];
  existingGroups: Array<ExistingGroup & { alias: string }>;
}

interface Dependencies {
  classify(input: {
    mode: "seed" | "continuation";
    tabs: OrganizerTab[];
    categories: Array<{ alias: string; title: string; existingGroupId?: number }>;
  }): Promise<unknown>;
  now(): number;
  onProgress?(processed: number, batch: number, totalBatches: number): void;
}

export async function organizeTabs(input: OrganizerInput, deps: Dependencies) {
  if (input.tabs.length < 2) {
    return { mode: "no-op" as const, groups: [] as PlannedGroup[] };
  }
  const startedAt = deps.now();
  const batches = createBatches(input.tabs, 50);
  const offeredGroups = input.existingGroups.map((group) => ({
    alias: group.alias,
    title: group.title,
    existingGroupId: group.id,
  }));
  let categories: Array<{
    alias: string;
    title: string;
    existingGroupId?: number;
  }> = [];
  const assignments = new Map<string, Set<number>>();

  for (let index = 0; index < batches.length; index += 1) {
    if (deps.now() - startedAt >= 60_000) break;
    const batch = batches[index]!;
    const availableGroups = index === 0 ? offeredGroups : categories;
    try {
      const raw = await deps.classify({
        mode: index === 0 ? "seed" : "continuation",
        tabs: batch,
        categories: availableGroups,
      });
      const valid = validateModelOutput(raw, {
        mode: index === 0 ? "seed" : "continuation",
        allowedTabAliases: new Set(batch.map((tab) => tab.alias)),
        existingGroups: new Map(
          availableGroups.map((group) => [group.alias, group]),
        ),
        maxGroups: 5,
      });
      if (index === 0 && valid.length === 0) {
        return fallback(input.tabs, "seed-invalid");
      }
      if (index === 0) {
        categories = establishCategories(valid, offeredGroups);
      }
      mergeAssignments(valid, batch, categories, assignments);
      deps.onProgress?.(
        Math.min((index + 1) * 50, input.tabs.length),
        index + 1,
        batches.length,
      );
    } catch {
      if (index === 0) return fallback(input.tabs, "seed-failed");
      break;
    }
  }

  return {
    mode: "ai" as const,
    groups: toPlans(categories, assignments),
  };
}

type ValidatedGroup = ReturnType<typeof validateModelOutput>[number];
type Category = {
  alias: string;
  title: string;
  existingGroupId?: number;
};

function establishCategories(
  groups: ValidatedGroup[],
  offered: Category[],
): Category[] {
  const byAlias = new Map(offered.map((group) => [group.alias, group]));
  let newIndex = 1;
  return groups.slice(0, 5).map((group) => {
    if (group.groupAlias) return byAlias.get(group.groupAlias)!;
    return { alias: `C${newIndex++}`, title: group.groupName };
  });
}

function mergeAssignments(
  groups: ValidatedGroup[],
  batch: OrganizerTab[],
  categories: Category[],
  assignments: Map<string, Set<number>>,
): void {
  const tabByAlias = new Map(batch.map((tab) => [tab.alias, tab.tabId]));
  const categoryByExistingAlias = new Map(
    categories.map((category) => [category.alias, category]),
  );
  const categoryByName = new Map(
    categories.map((category) => [category.title, category]),
  );

  for (const group of groups) {
    const category = group.groupAlias
      ? categoryByExistingAlias.get(group.groupAlias)
      : categoryByName.get(group.groupName);
    if (!category) continue;
    const ids = assignments.get(category.alias) ?? new Set<number>();
    for (const alias of group.tabAliases) {
      const tabId = tabByAlias.get(alias);
      if (tabId !== undefined) ids.add(tabId);
    }
    assignments.set(category.alias, ids);
  }
}

function toPlans(
  categories: Category[],
  assignments: Map<string, Set<number>>,
): PlannedGroup[] {
  return categories.flatMap((category) => {
    const tabIds = [...(assignments.get(category.alias) ?? [])];
    if (tabIds.length === 0) return [];
    return [{
      title: category.title,
      tabIds,
      ...(category.existingGroupId !== undefined
        ? { existingGroupId: category.existingGroupId }
        : {}),
    }];
  });
}

function fallback(tabs: OrganizerTab[], reason: string) {
  return {
    mode: "fallback" as const,
    reason,
    groups: createDomainFallback(tabs),
  };
}
```

Continuation responses never append a category. Existing categories selected by the
model count toward the five-category cap.

- [ ] **Step 4: Cover the state machine and verify**

Append these cases:

```ts
it("returns no-op for fewer than two tabs", async () => {
  const classify = vi.fn();
  expect(
    await organizeTabs(makeInput(1), { classify, now: () => 0 }),
  ).toEqual({ mode: "no-op", groups: [] });
  expect(classify).not.toHaveBeenCalled();
});

it.each([
  [50, 1],
  [51, 2],
  [103, 3],
])("classifies %i tabs in %i batches", async (count, expectedCalls) => {
  const classify = vi.fn(async ({ mode }) =>
    mode === "seed"
      ? [{ groupName: "Research", tabAliases: ["T1", "T2"] }]
      : [],
  );
  await organizeTabs(makeInput(count), { classify, now: () => 0 });
  expect(classify).toHaveBeenCalledTimes(expectedCalls);
});

it("stops continuation work at the 60-second deadline", async () => {
  const times = [0, 0, 60_000];
  const classify = vi.fn(async () => [
    { groupName: "Research", tabAliases: ["T1", "T2"] },
  ]);
  await organizeTabs(makeInput(103), {
    classify,
    now: () => times.shift() ?? 60_000,
  });
  expect(classify).toHaveBeenCalledTimes(1);
});

it("preserves existing group IDs and maps aliases back to tab IDs", async () => {
  const input = {
    ...makeInput(2),
    existingGroups: [
      { id: 9, alias: "G1", title: "Research", color: "blue" as const },
    ],
  };
  const result = await organizeTabs(input, {
    classify: vi.fn(async () => [
      { groupAlias: "G1", tabAliases: ["T1", "T2"] },
    ]),
    now: () => 0,
  });
  expect(result.groups).toEqual([
    { title: "Research", tabIds: [1, 2], existingGroupId: 9 },
  ]);
  expect(JSON.stringify(result)).not.toContain("groupAlias");
});
```

Run: `npm run check && npm test -- tests/organizer/organize.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/organizer tests/organizer
git commit -m "feat: orchestrate batched tab classification"
```

---

### Task 9: Persist Metadata-Only Locks and Query Chrome Tabs

**Files:**
- Create: `src/background/task-store.ts`
- Create: `src/background/tab-source.ts`
- Create: `tests/helpers/fake-chrome.ts`
- Create: `tests/background/task-store.test.ts`
- Create: `tests/background/tab-source.test.ts`

- [ ] **Step 1: Write failing lock and query tests**

```ts
// tests/background/task-store.test.ts
import { describe, expect, it } from "vitest";
import { TaskStore } from "../../src/background/task-store";
import { fakeSessionStorage } from "../helpers/fake-chrome";

describe("TaskStore", () => {
  it("allows one owner per window and reclaims an expired lock", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 100_000, 120_000);
    expect(await store.claim(1, "owner-a", 3)).toMatchObject({ acquired: true });
    expect(await store.claim(1, "owner-b", 3)).toMatchObject({ acquired: false });

    const later = new TaskStore(storage, () => 221_000, 120_000);
    expect(await later.claim(1, "owner-b", 3)).toMatchObject({ acquired: true });
  });

  it("never stores tab titles, URLs, prompts, or model output", async () => {
    const storage = fakeSessionStorage();
    const store = new TaskStore(storage, () => 1, 120_000);
    await store.claim(2, "owner", 10);
    expect(JSON.stringify(storage.data)).not.toMatch(/title|url|prompt|output/i);
  });
});
```

```ts
// tests/background/tab-source.test.ts
import { describe, expect, it } from "vitest";
import { ChromeTabSource } from "../../src/background/tab-source";
import { fakeChrome } from "../helpers/fake-chrome";

describe("ChromeTabSource", () => {
  it("returns only ungrouped, unpinned tabs with IDs", async () => {
    const chromeApi = fakeChrome({
      tabs: [
        { id: 1, windowId: 9, title: "A", url: "https://a.test", pinned: false, groupId: -1 },
        { id: 2, windowId: 9, title: "B", url: "https://b.test", pinned: true, groupId: -1 },
      ],
    });
    const result = await new ChromeTabSource(chromeApi).prepare(9);
    expect(result.tabs.map((tab) => tab.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/background/task-store.test.ts tests/background/tab-source.test.ts`

Expected: FAIL because the Chrome adapters are missing.

- [ ] **Step 3: Implement storage-session metadata and tab/group queries**

```ts
// src/background/task-store.ts
import type { TaskState } from "../shared/types";

type SessionArea = Pick<chrome.storage.StorageArea, "get" | "set" | "remove">;

export class TaskStore {
  constructor(
    private readonly storage: SessionArea = chrome.storage.session,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 120_000,
  ) {}

  async claim(windowId: number, ownerToken: string, totalTabs: number) {
    const current = await this.get(windowId);
    if (current && this.now() - current.updatedAt <= this.ttlMs) {
      if (current.ownerToken === ownerToken) {
        return { acquired: true as const, state: current };
      }
      return { acquired: false as const, state: current };
    }
    const state: TaskState = {
      windowId,
      ownerToken,
      taskId: crypto.randomUUID(),
      phase: "idle",
      processedTabs: 0,
      totalTabs,
      currentBatch: 0,
      totalBatches: Math.ceil(totalTabs / 50),
      updatedAt: this.now(),
    };
    await this.storage.set({ [this.key(windowId)]: state });
    return { acquired: true as const, state };
  }

  async get(windowId: number): Promise<TaskState | undefined> {
    const result = await this.storage.get(this.key(windowId));
    return result[this.key(windowId)] as TaskState | undefined;
  }

  async update(state: TaskState): Promise<void> {
    await this.storage.set({
      [this.key(state.windowId)]: this.toStoredState({
        ...state,
        updatedAt: this.now(),
      }),
    });
  }

  async release(windowId: number, taskId: string, ownerToken: string) {
    const current = await this.get(windowId);
    if (current?.taskId === taskId && current.ownerToken === ownerToken) {
      await this.storage.remove(this.key(windowId));
    }
  }

  private key(windowId: number) {
    return `task:${windowId}`;
  }

  private toStoredState(state: TaskState): TaskState {
    return {
      windowId: state.windowId,
      ownerToken: state.ownerToken,
      taskId: state.taskId,
      phase: state.phase,
      processedTabs: state.processedTabs,
      totalTabs: state.totalTabs,
      currentBatch: state.currentBatch,
      totalBatches: state.totalBatches,
      updatedAt: state.updatedAt,
      ...(state.downloadProgress !== undefined
        ? { downloadProgress: state.downloadProgress }
        : {}),
      ...(state.fallbackReason ? { fallbackReason: state.fallbackReason } : {}),
      ...(state.summary ? { summary: state.summary } : {}),
      ...(state.errorCode ? { errorCode: state.errorCode } : {}),
    };
  }
}
```

```ts
// src/background/tab-source.ts
import type { ExistingGroup, PreparedTask, TabSnapshot } from "../shared/types";

export class ChromeTabSource {
  constructor(private readonly api: typeof chrome = chrome) {}

  async prepare(windowId: number): Promise<Omit<PreparedTask, "taskId">> {
    const [tabs, groups] = await Promise.all([
      this.api.tabs.query({ windowId }),
      this.api.tabGroups.query({ windowId }),
    ]);
    return {
      windowId,
      tabs: tabs
        .filter(
          (tab) =>
            tab.id !== undefined &&
            !tab.pinned &&
            tab.groupId === this.api.tabGroups.TAB_GROUP_ID_NONE,
        )
        .map(
          (tab): TabSnapshot => ({
            id: tab.id!,
            windowId,
            title: tab.title ?? "",
            url: tab.url ?? "",
            pinned: false,
            groupId: tab.groupId,
          }),
        ),
      existingGroups: groups.map(
        (group): ExistingGroup => ({
          id: group.id,
          title: group.title ?? "",
          color: group.color,
        }),
      ),
    };
  }
}
```

```ts
// tests/helpers/fake-chrome.ts
import { vi } from "vitest";

export function fakeSessionStorage() {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(key: string) {
      return { [key]: data[key] };
    },
    async set(values: Record<string, unknown>) {
      Object.assign(data, values);
    },
    async remove(key: string) {
      delete data[key];
    },
  };
}

export function fakeChrome(input: {
  tabs?: chrome.tabs.Tab[];
  groups?: chrome.tabGroups.TabGroup[];
} = {}) {
  const tabs = input.tabs ?? [];
  const groups = input.groups ?? [];
  return {
    tabs: {
      query: vi.fn(async ({ windowId }: { windowId?: number }) =>
        tabs.filter((tab) => windowId === undefined || tab.windowId === windowId),
      ),
      get: vi.fn(async (tabId: number) => {
        const tab = tabs.find((candidate) => candidate.id === tabId);
        if (!tab) throw new Error("tab-not-found");
        return tab;
      }),
      group: vi.fn(async () => 100),
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      query: vi.fn(async ({ windowId }: { windowId?: number }) =>
        groups.filter((group) => windowId === undefined || group.windowId === windowId),
      ),
      get: vi.fn(async (groupId: number) => {
        const group = groups.find((candidate) => candidate.id === groupId);
        if (!group) throw new Error("group-not-found");
        return group;
      }),
      update: vi.fn(async (groupId: number, changes: object) => ({
        ...groups.find((group) => group.id === groupId),
        ...changes,
      })),
    },
  } as unknown as typeof chrome;
}
```

- [ ] **Step 4: Add ownership, reload, and Chrome-shape cases**

Keep the fake Chrome helper limited to methods used by production code and use its
Vitest spies to assert calls. Append these cases:

```ts
it("lets the same owner reclaim the existing task after reload", async () => {
  const storage = fakeSessionStorage();
  const store = new TaskStore(storage, () => 1, 120_000);
  const first = await store.claim(1, "owner", 3);
  const second = await store.claim(1, "owner", 3);
  expect(second).toEqual(first);
});

it("does not release another owner or another task", async () => {
  const storage = fakeSessionStorage();
  const store = new TaskStore(storage, () => 1, 120_000);
  const claim = await store.claim(1, "owner", 3);
  await store.release(1, claim.state.taskId, "different-owner");
  expect(await store.get(1)).toEqual(claim.state);
});
```

```ts
it("maps existing groups and tolerates missing optional tab fields", async () => {
  const api = fakeChrome({
    tabs: [
      { id: 1, windowId: 9, pinned: false, groupId: -1 },
      { windowId: 9, pinned: false, groupId: -1 },
      { id: 3, windowId: 9, pinned: false, groupId: 8 },
    ] as chrome.tabs.Tab[],
    groups: [
      { id: 8, windowId: 9, title: "Work", color: "blue", collapsed: false },
    ],
  });
  const result = await new ChromeTabSource(api).prepare(9);
  expect(result.tabs).toEqual([
    { id: 1, windowId: 9, title: "", url: "", pinned: false, groupId: -1 },
  ]);
  expect(result.existingGroups).toEqual([
    { id: 8, title: "Work", color: "blue" },
  ]);
});
```

Run: `npm run check && npm test -- tests/background/task-store.test.ts tests/background/tab-source.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/background/task-store.ts src/background/tab-source.ts tests/background tests/helpers
git commit -m "feat: add window task locks and tab queries"
```

---

### Task 10: Execute Groups Best-Effort and Route Service Worker Messages

**Files:**
- Create: `src/background/group-executor.ts`
- Modify: `src/background/index.ts`
- Create: `tests/background/group-executor.test.ts`
- Create: `tests/background/index.test.ts`

- [ ] **Step 1: Write failing revalidation and partial-failure tests**

```ts
// tests/background/group-executor.test.ts
import { describe, expect, it, vi } from "vitest";
import { GroupExecutor } from "../../src/background/group-executor";
import { fakeChrome } from "../helpers/fake-chrome";

describe("GroupExecutor", () => {
  it("reuses a same-name group and skips changed tabs", async () => {
    const api = fakeChrome({
      tabs: [
        { id: 1, windowId: 4, pinned: false, groupId: -1 },
        { id: 2, windowId: 4, pinned: true, groupId: -1 },
      ],
      groups: [{ id: 8, windowId: 4, title: "Research", color: "blue" }],
    });
    const summary = await new GroupExecutor(api).execute(4, [
      { title: "Research", tabIds: [1, 2] },
    ]);
    expect(api.tabs.group).toHaveBeenCalledWith({ groupId: 8, tabIds: [1] });
    expect(summary.tabsGrouped).toBe(1);
    expect(summary.tabsSkipped).toBe(1);
  });

  it("continues after one group fails", async () => {
    const api = fakeChromeForPartialFailure();
    const summary = await new GroupExecutor(api).execute(4, [
      { title: "One", tabIds: [1, 2] },
      { title: "Two", tabIds: [3, 4] },
    ]);
    expect(summary.tabsFailed).toBe(2);
    expect(summary.tabsGrouped).toBe(2);
  });
});

function fakeChromeForPartialFailure() {
  const api = fakeChrome({
    tabs: [1, 2, 3, 4].map((id) => ({
      id,
      windowId: 4,
      pinned: false,
      groupId: -1,
    })) as chrome.tabs.Tab[],
  });
  const group = api.tabs.group as unknown as ReturnType<typeof vi.fn>;
  group
    .mockRejectedValueOnce(new Error("first-group-failed"))
    .mockResolvedValueOnce(101);
  return api;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/background/group-executor.test.ts tests/background/index.test.ts`

Expected: FAIL because execution and routing are missing.

- [ ] **Step 3: Implement revalidation, reuse/create, color selection, and routing**

```ts
// src/background/group-executor.ts
import { normalizeGroupName } from "../domain/group-name";
import type { ExecutionSummary, PlannedGroup } from "../shared/types";

const COLORS: chrome.tabGroups.ColorEnum[] = [
  "grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange",
];

export class GroupExecutor {
  constructor(
    private readonly api: typeof chrome = chrome,
    private readonly pickColor = () =>
      COLORS[crypto.getRandomValues(new Uint32Array(1))[0]! % COLORS.length]!,
  ) {}

  async execute(windowId: number, plans: PlannedGroup[]): Promise<ExecutionSummary> {
    const summary: ExecutionSummary = {
      groupsCreated: 0,
      groupsReused: 0,
      tabsGrouped: 0,
      tabsSkipped: 0,
      tabsFailed: 0,
    };
    for (const plan of plans.slice(0, 5)) {
      const validIds = await this.revalidate(windowId, plan.tabIds);
      summary.tabsSkipped += plan.tabIds.length - validIds.length;
      if (validIds.length === 0) continue;
      try {
        const existing = await this.findExisting(windowId, plan);
        if (!existing && validIds.length < 2) {
          summary.tabsSkipped += validIds.length;
          continue;
        }
        if (existing) {
          await this.api.tabs.group({ groupId: existing.id, tabIds: validIds });
          summary.groupsReused += 1;
        } else {
          const groupId = await this.api.tabs.group({
            createProperties: { windowId },
            tabIds: validIds,
          });
          await this.api.tabGroups.update(groupId, {
            title: normalizeGroupName(plan.title),
            color: this.pickColor(),
          });
          summary.groupsCreated += 1;
        }
        summary.tabsGrouped += validIds.length;
      } catch {
        summary.tabsFailed += validIds.length;
      }
    }
    return summary;
  }

  private async revalidate(windowId: number, tabIds: number[]): Promise<number[]> {
    const uniqueIds = [...new Set(tabIds)];
    const results = await Promise.all(
      uniqueIds.map(async (tabId) => {
        try {
          const tab = await this.api.tabs.get(tabId);
          return tab.windowId === windowId &&
            !tab.pinned &&
            tab.groupId === this.api.tabGroups.TAB_GROUP_ID_NONE
            ? tabId
            : undefined;
        } catch {
          return undefined;
        }
      }),
    );
    return results.filter((tabId): tabId is number => tabId !== undefined);
  }

  private async findExisting(windowId: number, plan: PlannedGroup) {
    if (plan.existingGroupId !== undefined) {
      try {
        const group = await this.api.tabGroups.get(plan.existingGroupId);
        if (group.windowId === windowId) return group;
      } catch {
        // Continue to same-name lookup.
      }
    }
    const expected = normalizeGroupName(plan.title);
    const groups = await this.api.tabGroups.query({ windowId });
    return groups.find(
      (group) => normalizeGroupName(group.title ?? "") === expected,
    );
  }
}
```

```ts
// src/background/index.ts
import { GroupExecutor } from "./group-executor";
import { ChromeTabSource } from "./tab-source";
import { TaskStore } from "./task-store";
import { isOrganizerRequest } from "../shared/messages";

const store = new TaskStore();
const source = new ChromeTabSource();
const executor = new GroupExecutor();

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "organize-tabs") return;
  const window = await chrome.windows.getLastFocused();
  if (window.id !== undefined) await chrome.sidePanel.open({ windowId: window.id });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOrganizerRequest(message)) return false;
  void handleMessage(message)
    .then((value) => sendResponse({ ok: true, value }))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "unknown-error",
      }),
    );
  return true;
});

async function handleMessage(message: import("../shared/messages").OrganizerRequest) {
  switch (message.type) {
    case "get-task-state":
      return store.get(message.windowId);
    case "prepare-task": {
      const prepared = await source.prepare(message.windowId);
      const claim = await store.claim(
        message.windowId,
        message.ownerToken,
        prepared.tabs.length,
      );
      if (!claim.acquired) {
        return { status: "busy" as const, state: claim.state };
      }
      return {
        status: "prepared" as const,
        state: claim.state,
        task: { ...prepared, taskId: claim.state.taskId },
      };
    }
    case "update-task-state":
      await assertOwner(
        message.state.windowId,
        message.state.taskId,
        message.state.ownerToken,
      );
      await store.update(message.state);
      return undefined;
    case "execute-groups": {
      await assertOwner(message.windowId, message.taskId, message.ownerToken);
      return executor.execute(message.windowId, message.groups);
    }
    case "release-task":
      await assertOwner(message.windowId, message.taskId, message.ownerToken);
      await store.release(message.windowId, message.taskId, message.ownerToken);
      return undefined;
  }
}

async function assertOwner(
  windowId: number,
  taskId: string,
  ownerToken: string,
): Promise<void> {
  const current = await store.get(windowId);
  if (current?.taskId !== taskId || current.ownerToken !== ownerToken) {
    throw new Error("task-owner-mismatch");
  }
}
```

`prepare-task` must claim the lock, query tabs/groups, attach the generated task ID,
and return the current state when another owner already holds the window lock.

- [ ] **Step 4: Test all execution and routing branches**

Append these executor cases:

```ts
it("skips closed, moved, pinned, and manually grouped tabs", async () => {
  const api = fakeChrome({
    tabs: [
      { id: 2, windowId: 99, pinned: false, groupId: -1 },
      { id: 3, windowId: 4, pinned: true, groupId: -1 },
      { id: 4, windowId: 4, pinned: false, groupId: 7 },
    ] as chrome.tabs.Tab[],
  });
  const summary = await new GroupExecutor(api).execute(4, [
    { title: "Work", tabIds: [1, 2, 3, 4] },
  ]);
  expect(summary.tabsSkipped).toBe(4);
  expect(api.tabs.group).not.toHaveBeenCalled();
});

it("caps execution at five plans", async () => {
  const tabs = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    windowId: 4,
    pinned: false,
    groupId: -1,
  })) as chrome.tabs.Tab[];
  const api = fakeChrome({ tabs });
  await new GroupExecutor(api, () => "blue").execute(
    4,
    Array.from({ length: 6 }, (_, index) => ({
      title: `G${index}`,
      tabIds: [index * 2 + 1, index * 2 + 2],
    })),
  );
  expect(api.tabs.group).toHaveBeenCalledTimes(5);
});
```

In `tests/background/index.test.ts`, stub the global Chrome event objects before
importing `src/background/index.ts`:

```ts
it("opens the last-focused window for the shortcut", async () => {
  const commandListeners: Array<(command: string) => void> = [];
  const open = vi.fn(async () => undefined);
  vi.stubGlobal("chrome", {
    sidePanel: {
      setPanelBehavior: vi.fn(async () => undefined),
      open,
    },
    commands: {
      onCommand: { addListener: (listener: (command: string) => void) =>
        commandListeners.push(listener) },
    },
    runtime: { onMessage: { addListener: vi.fn() } },
    windows: { getLastFocused: vi.fn(async () => ({ id: 44 })) },
    storage: { session: fakeSessionStorage() },
    tabs: fakeChrome().tabs,
    tabGroups: fakeChrome().tabGroups,
  });
  await import("../../src/background/index");
  commandListeners[0]!("organize-tabs");
  await vi.waitFor(() => expect(open).toHaveBeenCalledWith({ windowId: 44 }));
});
```

```ts
it("ignores unknown messages and rejects a stale owner", async () => {
  vi.resetModules();
  let messageListener!: (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => boolean;
  const storage = fakeSessionStorage();
  await storage.set({
    "task:1": {
      windowId: 1,
      ownerToken: "owner-a",
      taskId: "task-a",
      phase: "running",
      processedTabs: 0,
      totalTabs: 2,
      currentBatch: 1,
      totalBatches: 1,
      updatedAt: Date.now(),
    },
  });
  const api = fakeChrome();
  vi.stubGlobal("chrome", {
    sidePanel: {
      setPanelBehavior: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
    },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: {
      onMessage: {
        addListener: vi.fn((listener) => {
          messageListener = listener;
        }),
      },
    },
    windows: { getLastFocused: vi.fn() },
    storage: { session: storage },
    tabs: api.tabs,
    tabGroups: api.tabGroups,
  });
  await import("../../src/background/index");
  expect(
    messageListener(
      { type: "unknown" },
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    ),
  ).toBe(false);

  const sendResponse = vi.fn();
  expect(
    messageListener(
      {
        type: "release-task",
        windowId: 1,
        taskId: "task-a",
        ownerToken: "owner-b",
      },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    ),
  ).toBe(true);
  await vi.waitFor(() =>
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "task-owner-mismatch",
    }),
  );
  expect(JSON.stringify(sendResponse.mock.calls)).not.toMatch(/https?:|secret title/);
});
```

Run: `npm run check && npm test -- tests/background`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/background tests/background tests/helpers
git commit -m "feat: execute and coordinate tab grouping"
```

---

### Task 11: Build the Side Panel State Machine

**Files:**
- Create: `src/sidepanel/model.ts`
- Create: `src/sidepanel/browser-deps.ts`
- Create: `src/sidepanel/view.ts`
- Modify: `src/sidepanel/index.ts`
- Modify: `src/sidepanel/styles.css`
- Modify: `sidepanel.html`
- Create: `tests/sidepanel/model.test.ts`
- Create: `tests/sidepanel/view.test.ts`

- [ ] **Step 1: Write failing state-transition tests**

```ts
// tests/sidepanel/model.test.ts
import { describe, expect, it, vi } from "vitest";
import { SidePanelModel } from "../../src/sidepanel/model";

describe("SidePanelModel", () => {
  it("auto-starts when the model is available", async () => {
    const deps = makePanelDeps({ availability: "available" });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(deps.organize).toHaveBeenCalledOnce();
  });

  it("waits for a click when the model is downloadable", async () => {
    const deps = makePanelDeps({ availability: "downloadable" });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(model.state.phase).toBe("needs-setup");
    expect(deps.organize).not.toHaveBeenCalled();
    await model.prepareAndRun();
    expect(deps.organize).toHaveBeenCalledOnce();
  });

  it("uses fallback without a second click when the API is unavailable", async () => {
    const deps = makePanelDeps({ availability: "unavailable" });
    const model = new SidePanelModel(deps);
    await model.initialize();
    expect(deps.runFallback).toHaveBeenCalledOnce();
  });
});

function makePanelDeps({
  availability,
}: {
  availability: "available" | "downloadable" | "downloading" | "unavailable";
}) {
  const state = {
    windowId: 1,
    ownerToken: "owner",
    taskId: "task",
    phase: "idle" as const,
    processedTabs: 0,
    totalTabs: 2,
    currentBatch: 0,
    totalBatches: 1,
    updatedAt: 0,
  };
  return {
    getWindowId: vi.fn(async () => 1),
    getOwnerToken: vi.fn(() => "owner"),
    prepare: vi.fn(async () => ({
      status: "prepared" as const,
      state,
      task: {
        taskId: "task",
        windowId: 1,
        tabs: [
          { id: 1, windowId: 1, title: "A", url: "https://a.test", pinned: false, groupId: -1 },
          { id: 2, windowId: 1, title: "B", url: "https://b.test", pinned: false, groupId: -1 },
        ],
        existingGroups: [],
      },
    })),
    availability: vi.fn(async () => availability),
    organize: vi.fn(async () => ({ mode: "ai" as const, groups: [] })),
    fallback: vi.fn(async () => ({ mode: "fallback" as const, groups: [], reason: "test" })),
    execute: vi.fn(async () => ({
      groupsCreated: 0,
      groupsReused: 0,
      tabsGrouped: 0,
      tabsSkipped: 0,
      tabsFailed: 0,
    })),
    update: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
    onState: vi.fn(),
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/sidepanel`

Expected: FAIL because the Side Panel model and view do not exist.

- [ ] **Step 3: Implement the controller, renderer, and DOM shell**

```html
<!-- sidepanel.html body -->
<main id="app" aria-live="polite">
  <header>
    <p class="eyebrow">端侧整理</p>
    <h1>AI Tab Organizer</h1>
  </header>
  <section id="status" class="card"></section>
  <button id="primary-action" type="button" hidden></button>
</main>
<script type="module" src="/src/sidepanel/index.ts"></script>
```

```ts
// src/sidepanel/view.ts
import type { TaskState } from "../shared/types";

export function render(
  state: TaskState,
  elements: { status: HTMLElement; action: HTMLButtonElement },
) {
  const labels: Record<TaskState["phase"], string> = {
    idle: "正在检查当前窗口…",
    "needs-setup": "首次使用需要准备 Chrome 本地 AI。",
    downloading: `正在准备模型… ${Math.round((state.downloadProgress ?? 0) * 100)}%`,
    running: `正在整理第 ${state.currentBatch}/${state.totalBatches} 批`,
    completed: "AI 分组完成",
    "fallback-completed": "已按域名完成分组",
    "no-op": "当前没有需要整理的标签",
    failed: "整理未完全成功",
  };
  elements.status.textContent = labels[state.phase];
  elements.action.hidden = state.phase !== "needs-setup";
  elements.action.textContent = "准备本地 AI";
}
```

```ts
// src/sidepanel/model.ts
import type {
  ExecutionSummary,
  PlannedGroup,
  PreparedTask,
  TaskState,
} from "../shared/types";

type Availability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

type PreparedResponse =
  | { status: "busy"; state: TaskState }
  | { status: "prepared"; state: TaskState; task: PreparedTask };

interface OrganizerResult {
  mode: "ai" | "fallback" | "no-op";
  groups: PlannedGroup[];
  reason?: string;
}

export interface PanelDependencies {
  getWindowId(): Promise<number>;
  getOwnerToken(): string;
  prepare(windowId: number, ownerToken: string): Promise<PreparedResponse>;
  availability(): Promise<Availability>;
  organize(
    task: PreparedTask,
    callbacks: {
      onDownload(loaded: number): Promise<void>;
      onProgress(processed: number, batch: number, total: number): Promise<void>;
    },
  ): Promise<OrganizerResult>;
  fallback(task: PreparedTask, reason: string): Promise<OrganizerResult>;
  execute(
    task: PreparedTask,
    ownerToken: string,
    groups: PlannedGroup[],
  ): Promise<ExecutionSummary>;
  update(state: TaskState): Promise<void>;
  release(state: TaskState): Promise<void>;
  onState(state: TaskState): void;
}

export class SidePanelModel {
  state!: TaskState;
  private task?: PreparedTask;
  private readonly ownerToken: string;

  constructor(private readonly deps: PanelDependencies) {
    this.ownerToken = deps.getOwnerToken();
  }

  async initialize(): Promise<void> {
    const windowId = await this.deps.getWindowId();
    const prepared = await this.deps.prepare(windowId, this.ownerToken);
    this.state = prepared.state;
    this.deps.onState(this.state);
    if (prepared.status === "busy") return;
    this.task = prepared.task;
    if (prepared.task.tabs.length < 2) {
      await this.finish("no-op");
      return;
    }

    const availability = await this.deps.availability();
    if (availability === "available") {
      await this.runAi();
    } else if (availability === "unavailable") {
      await this.runFallback("model-unavailable");
    } else {
      await this.transition({ phase: "needs-setup" });
    }
  }

  async prepareAndRun(): Promise<void> {
    if (!this.task || this.state.phase !== "needs-setup") return;
    await this.runAi();
  }

  private async runAi(): Promise<void> {
    if (!this.task) return;
    await this.transition({ phase: "running" });
    try {
      const result = await this.deps.organize(this.task, {
        onDownload: async (loaded) => {
          await this.transition({ phase: "downloading", downloadProgress: loaded });
        },
        onProgress: async (processed, batch, total) => {
          await this.transition({
            phase: "running",
            processedTabs: processed,
            currentBatch: batch,
            totalBatches: total,
          });
        },
      });
      if (result.mode === "fallback") {
        await this.executeAndFinish(
          result.groups,
          "fallback-completed",
          result.reason,
        );
      } else if (result.mode === "no-op") {
        await this.finish("no-op");
      } else {
        await this.executeAndFinish(result.groups, "completed");
      }
    } catch {
      await this.runFallback("model-failed");
    }
  }

  private async runFallback(reason: string): Promise<void> {
    if (!this.task) return;
    const result = await this.deps.fallback(this.task, reason);
    if (result.groups.length === 0) {
      await this.finish("no-op", { fallbackReason: reason });
      return;
    }
    await this.executeAndFinish(
      result.groups,
      "fallback-completed",
      result.reason ?? reason,
    );
  }

  private async executeAndFinish(
    groups: PlannedGroup[],
    phase: "completed" | "fallback-completed",
    fallbackReason?: string,
  ): Promise<void> {
    if (!this.task) return;
    try {
      const summary = await this.deps.execute(
        this.task,
        this.ownerToken,
        groups,
      );
      await this.finish(phase, {
        summary,
        ...(fallbackReason ? { fallbackReason } : {}),
      });
    } catch {
      await this.finish("failed", { errorCode: "group-execution-failed" });
    }
  }

  private async finish(
    phase: TaskState["phase"],
    patch: Partial<TaskState> = {},
  ): Promise<void> {
    await this.transition({ ...patch, phase });
    await this.deps.release(this.state);
  }

  private async transition(patch: Partial<TaskState>): Promise<void> {
    this.state = { ...this.state, ...patch, updatedAt: Date.now() };
    this.deps.onState(this.state);
    await this.deps.update(this.state);
  }
}
```

```ts
// src/sidepanel/browser-deps.ts
import { withLanguageModel, promptWithTimeout } from "../ai/language-model";
import { aliasMap } from "../domain/aliases";
import { prepareCandidates } from "../domain/candidates";
import { createDomainFallback } from "../domain/fallback";
import { MODEL_RESPONSE_SCHEMA } from "../domain/model-output";
import { buildBatchPrompt } from "../domain/prompts";
import { organizeTabs } from "../organizer/organize";
import type { OrganizerResponse, OrganizerRequest } from "../shared/messages";
import type {
  ExecutionSummary,
  PreparedTask,
  TaskState,
} from "../shared/types";
import type { PanelDependencies } from "./model";

async function send<T>(message: OrganizerRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(
    message,
  )) as OrganizerResponse<T>;
  if (!response.ok) throw new Error(response.error);
  return response.value;
}

function toOrganizerInput(task: PreparedTask) {
  const prepared = prepareCandidates(task.tabs);
  const groupAliases = aliasMap("G", task.existingGroups);
  return {
    tabs: prepared.items.map((item) => ({
      alias: item.alias,
      tabId: prepared.tabIdByAlias.get(item.alias)!,
      title: item.title,
      ...(item.location.kind === "web"
        ? {
            host: item.location.host,
            ...(item.location.path ? { path: item.location.path } : {}),
          }
        : {}),
    })),
    existingGroups: groupAliases.aliasByIndex.map((alias) => {
      const group = groupAliases.valueByAlias.get(alias)!;
      return { ...group, alias };
    }),
  };
}

export function createBrowserDependencies(
  onState: (state: TaskState) => void,
): PanelDependencies {
  return {
    async getWindowId() {
      const window = await chrome.windows.getCurrent();
      if (window.id === undefined) throw new Error("window-id-missing");
      return window.id;
    },
    getOwnerToken() {
      const key = "organizer-owner-token";
      const current = sessionStorage.getItem(key);
      if (current) return current;
      const created = crypto.randomUUID();
      sessionStorage.setItem(key, created);
      return created;
    },
    prepare(windowId, ownerToken) {
      return send({
        type: "prepare-task",
        windowId,
        ownerToken,
      });
    },
    async availability() {
      const api = (globalThis as typeof globalThis & {
        LanguageModel?: LanguageModelStatic;
      }).LanguageModel;
      return api ? api.availability() : "unavailable";
    },
    async organize(task, callbacks) {
      const api = (globalThis as typeof globalThis & {
        LanguageModel?: LanguageModelStatic;
      }).LanguageModel;
      if (!api) throw new Error("model-unavailable");
      const input = toOrganizerInput(task);
      return withLanguageModel(api, callbacks.onDownload, async (session) =>
        organizeTabs(input, {
          now: Date.now,
          onProgress: callbacks.onProgress,
          async classify(batch) {
            const text = await promptWithTimeout(
              session,
              buildBatchPrompt({
                mode: batch.mode,
                tabs: batch.tabs,
                groups: batch.categories,
              }),
              MODEL_RESPONSE_SCHEMA,
              15_000,
            );
            return JSON.parse(text) as unknown;
          },
        }),
      );
    },
    async fallback(task, reason) {
      const input = toOrganizerInput(task);
      return {
        mode: "fallback",
        reason,
        groups: createDomainFallback(input.tabs),
      };
    },
    execute(task, ownerToken, groups) {
      return send<ExecutionSummary>({
        type: "execute-groups",
        windowId: task.windowId,
        taskId: task.taskId,
        ownerToken,
        groups,
      });
    },
    update(state) {
      return send<void>({ type: "update-task-state", state });
    },
    release(state) {
      return send<void>({
        type: "release-task",
        windowId: state.windowId,
        taskId: state.taskId,
        ownerToken: state.ownerToken,
      });
    },
    onState,
  };
}
```

```ts
// src/sidepanel/index.ts
import "./styles.css";
import { createBrowserDependencies } from "./browser-deps";
import { destroyActiveLanguageModelSession } from "../ai/language-model";
import { SidePanelModel } from "./model";
import { render } from "./view";

const status = document.querySelector<HTMLElement>("#status");
const action = document.querySelector<HTMLButtonElement>("#primary-action");
if (!status || !action) throw new Error("side-panel-dom-missing");

const model = new SidePanelModel(createBrowserDependencies((state) =>
  render(state, { status, action }),
));
action.addEventListener("click", () => void model.prepareAndRun());
window.addEventListener("pagehide", destroyActiveLanguageModelSession);
void model.initialize();
```

```css
/* src/sidepanel/styles.css */
:root {
  font-family: system-ui, sans-serif;
  color: #172033;
  background: #f7f8fb;
}

body {
  margin: 0;
}

#app {
  display: grid;
  gap: 16px;
  padding: 20px;
}

.eyebrow {
  margin: 0;
  color: #5b6475;
  font-size: 12px;
  text-transform: uppercase;
}

h1 {
  margin: 4px 0 0;
  font-size: 22px;
}

.card {
  min-height: 72px;
  padding: 16px;
  border: 1px solid #d9deea;
  border-radius: 12px;
  background: #fff;
}

button {
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  color: #fff;
  background: #315efb;
  font: inherit;
}
```

Do not place titles, URLs, prompts, or raw model output in `TaskState`.

- [ ] **Step 4: Complete UI, reload, and privacy tests**

Append these model cases:

```ts
it("shows an existing busy task without starting another run", async () => {
  const deps = makePanelDeps({ availability: "available" });
  deps.prepare.mockResolvedValueOnce({
    status: "busy",
    state: {
      ...await deps.prepare().then((value) => value.state),
      phase: "running",
    },
  });
  const model = new SidePanelModel(deps);
  await model.initialize();
  expect(deps.organize).not.toHaveBeenCalled();
  expect(deps.onState).toHaveBeenCalledWith(
    expect.objectContaining({ phase: "running" }),
  );
});

it("falls back after model creation or seed classification fails", async () => {
  const deps = makePanelDeps({ availability: "available" });
  deps.organize.mockRejectedValueOnce(new Error("model-create-failed"));
  const model = new SidePanelModel(deps);
  await model.initialize();
  expect(deps.fallback).toHaveBeenCalledWith(
    expect.anything(),
    "model-failed",
  );
});

it("reports an execution transport failure as failed", async () => {
  const deps = makePanelDeps({ availability: "available" });
  deps.organize.mockResolvedValueOnce({
    mode: "ai",
    groups: [{ title: "Work", tabIds: [1, 2] }],
  });
  deps.execute.mockRejectedValueOnce(new Error("worker-gone"));
  const model = new SidePanelModel(deps);
  await model.initialize();
  expect(model.state.phase).toBe("failed");
  expect(model.state.errorCode).toBe("group-execution-failed");
  expect(deps.release).toHaveBeenCalledOnce();
});
```

```ts
// tests/sidepanel/view.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "../../src/sidepanel/view";

it.each([
  ["idle", "正在检查"],
  ["needs-setup", "首次使用"],
  ["downloading", "正在准备模型"],
  ["running", "正在整理"],
  ["completed", "AI 分组完成"],
  ["fallback-completed", "已按域名"],
  ["no-op", "没有需要整理"],
  ["failed", "未完全成功"],
] as const)("renders %s", (phase, text) => {
  const status = document.createElement("section");
  const action = document.createElement("button");
  render(
    {
      windowId: 1,
      ownerToken: "owner",
      taskId: "task",
      phase,
      processedTabs: 0,
      totalTabs: 2,
      currentBatch: 1,
      totalBatches: 1,
      updatedAt: 0,
      downloadProgress: 0.5,
    },
    { status, action },
  );
  expect(status.textContent).toContain(text);
  expect(action.hidden).toBe(phase !== "needs-setup");
});
```

Use a DOM test environment only for `view.test.ts`; keep `model.test.ts` in Node with
injected effects.

Run: `npm run check && npm test -- tests/sidepanel`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sidepanel.html src/sidepanel tests/sidepanel
git commit -m "feat: add Side Panel organizer workflow"
```

---

### Task 12: Verify Packaging, Privacy, and Chrome Acceptance

**Files:**
- Create: `tests/privacy.test.ts`
- Create: `tests/build-output.test.ts`
- Create: `README.md`
- Create: `docs/manual-test-checklist.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add failing privacy and build-output tests**

```ts
// tests/privacy.test.ts
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
```

```ts
// tests/build-output.test.ts
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
```

- [ ] **Step 2: Run the checks in the order that exposes the missing build precondition**

Run: `npm test -- tests/privacy.test.ts`

Expected: PASS.

Run: `npx vitest run tests/build-output.test.ts`

Expected: FAIL on a clean checkout when `dist/` has not been built.

- [ ] **Step 3: Make verification deterministic and document operation**

Change `package.json` scripts to:

```json
{
  "scripts": {
    "build": "vite build",
    "check": "tsc --noEmit",
    "test": "vitest run --exclude tests/build-output.test.ts",
    "test:watch": "vitest",
    "test:build": "npm run build && vitest run tests/build-output.test.ts",
    "verify": "npm run check && npm run test && npm run test:build"
  }
}
```

Write `README.md` with exact commands:

````md
# AI Tab Organizer

## Development

```bash
npm install
npm run verify
```

## Load in Chrome

1. Use Chrome 138 or newer.
2. Run `npm run build`.
3. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
4. Select this repository's `dist/` directory.
5. Open at least two unpinned, ungrouped tabs and click the extension action.

All classification runs through Chrome's built-in on-device `LanguageModel`.
The extension has no host permissions and does not persist tab titles, URLs,
prompts, or model responses.

The 800 ms figure is a non-blocking target for a prewarmed model and a small batch.
Hard limits are 15 seconds per batch and 60 seconds per task.
````

```md
<!-- docs/manual-test-checklist.md -->
# AI Tab Organizer V1 Manual Test Checklist

Environment:

- Chrome version:
- Operating system:
- Prompt API availability:

## Trigger and model lifecycle

- [ ] Action click opens the Side Panel and starts automatically when available.
- [ ] `Alt+Shift+G` opens the Side Panel for the focused window.
- [ ] `downloadable` shows “准备本地 AI” and waits for a click.
- [ ] Download progress is visible and completion continues automatically.
- [ ] `unavailable` performs domain fallback without another click.
- [ ] Closing/reloading the Side Panel destroys the active session.

## Classification

- [ ] Two eligible tabs can form one group.
- [ ] 50 tabs use one batch.
- [ ] 51 tabs use seed plus one continuation batch.
- [ ] 103 tabs use three batches and no more than five groups.
- [ ] English pages produce concise English group names.
- [ ] Chinese pages are handled as experimental and fail safely to fallback.
- [ ] Mixed Chinese/English input does not expose raw tab IDs to model output.
- [ ] Record prewarmed small-batch latency; exceeding 800 ms is noted but does not fail release.
- [ ] A first-batch failure performs full domain fallback.
- [ ] A later-batch failure preserves validated earlier results.

## Chrome state changes

- [ ] Pinned and already grouped tabs are untouched.
- [ ] Closed, moved, newly pinned, and manually grouped tabs are skipped.
- [ ] A same-name existing group is reused without changing its color.
- [ ] One group API failure does not roll back another successful group.
- [ ] Repeated trigger in one window does not start a concurrent task.
- [ ] Side Panel reload resumes with the same owner token.
- [ ] A stale task lock can be reclaimed after its TTL.

## Privacy

- [ ] DevTools Network shows no extension-originated remote AI request.
- [ ] Manifest has no host permissions.
- [ ] `chrome.storage.session` contains task metadata only.
- [ ] Logs contain no title, URL, prompt, or model response.
- [ ] Every success, failure, timeout, and fallback path destroys the model session.

Skipped cases and environment reasons:
```

Add `*.log` and `.DS_Store` to `.gitignore`.

- [ ] **Step 4: Run full automated verification and inspect the package**

Run: `npm run verify`

Expected: type checking, all Vitest suites, and the production build PASS.

Run: `find dist -maxdepth 2 -type f -print | sort`

Expected: manifest, background worker, Side Panel HTML, and local JS/CSS assets only;
no source maps unless intentionally enabled and no remotely hosted runtime asset.

Run: `rg -n "https?://|fetch\\(|XMLHttpRequest|WebSocket" src public dist`

Expected: no remote runtime request implementation. Documentation links are outside
the extension bundle.

- [ ] **Step 5: Perform Chrome manual acceptance**

Load `dist/` unpacked in Chrome 138+ and execute every checkbox in
`docs/manual-test-checklist.md`. Record the tested Chrome version, operating system,
model availability state, and any skipped hardware-dependent case at the bottom of
the checklist.

Expected: all applicable cases PASS; skipped cases state an explicit environment
reason rather than being silently omitted.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore README.md docs tests
git commit -m "docs: add verification and acceptance guide"
```

---

## Final Verification

- [ ] Run `npm run verify`.
- [ ] Run `git status --short` and confirm only intentional manual-test notes remain.
- [ ] Inspect `dist/manifest.json` and confirm Chrome 138, MV3, no host permissions,
  and only `tabs`, `tabGroups`, `sidePanel`, and `storage` permissions.
- [ ] Confirm unit tests explicitly cover all design requirements, including Chinese
  experimental handling, first-batch fallback, continuation partial results,
  five-group cap, two-tab seed minimum, task-lock recovery, best-effort execution,
  and guaranteed `session.destroy()`.
- [ ] Load `dist/` in Chrome and complete the manual checklist before declaring V1
  complete.

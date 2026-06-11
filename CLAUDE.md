# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Install dependencies
npm install

# Build for production (outputs to dist/)
npm run build

# Type check without emitting
npm run check

# Run all tests (excludes build-output tests)
npm run test

# Run tests in watch mode
npm run test:watch

# Run build output validation tests (after npm run build)
npm run test:build

# Full verification: type check + all tests
npm run verify
```

## Architecture

### Chrome MV3 Extension Structure

This is a Chrome Manifest V3 extension that uses Chrome's built-in LanguageModel (Gemini Nano) to classify and group browser tabs locally. The extension has **no host_permissions** and follows a privacy-first design.

**Entry Points (Vite multi-entry build):**
- `src/background/index.ts` → `dist/background.js` (service worker)
- `sidepanel.html` → `dist/sidepanel.html` (side panel UI)

### Core Architecture: Pure Domain Logic + Chrome Adapters

The codebase separates pure domain logic (testable without Chrome APIs) from Chrome API adapters:

**Pure Domain Logic (`src/domain/`):**
- `url.ts` - URL sanitization (strips credentials, query, fragment; caps at 2 path segments × 80 chars)
- `aliases.ts` - Generates T1/T2/T3 (tabs) or G1/G2/G3 (existing groups) aliases for model prompts
- `candidates.ts` - Filters pinned/grouped tabs, applies aliases
- `batching.ts` - Creates domain-diverse batches using PSL (Public Suffix List via `tldts`); round-robin by registrable domain, 50 tabs per batch
- `group-name.ts` - Normalizes group names (CJK: 4 chars, others: 12 chars)
- `model-output.ts` - Validates and sanitizes AI model output; enforces min tabs (seed=2, continuation=1), caps at 5 groups
- `fallback.ts` - Domain-based fallback grouping when AI is unavailable
- `prompts.ts` - System prompt (English constraints) and batch prompt builders (seed/continuation modes)

**Orchestrator (`src/organizer/`):**
- `organize.ts` - Seed/continuation batch orchestration with 60-second deadline; returns `{mode: "no-op" | "ai" | "fallback", groups: PlannedGroup[]}`

**Chrome API Adapters (`src/background/`):**
- `task-store.ts` - Window-level task locks with 120s TTL and owner tokens; metadata-only storage via whitelist (`toStoredState` strips sensitive data)
- `tab-source.ts` - Queries Chrome tabs/groups API, filters ungrouped/unpinned tabs
- `group-executor.ts` - Revalidates tabs before grouping, reuses same-name groups, creates new groups with random colors; best-effort execution
- `index.ts` - Service worker: message routing (5 types), keyboard shortcut handler

**Side Panel (`src/sidepanel/`):**
- `model.ts` - State machine (idle → needs-setup/downloading/running → completed/failed); auto-start when model available, click-to-start when downloadable
- `view.ts` - Renders UI with Chinese labels for all 8 TaskPhase states
- `browser-deps.ts` - Bridges to background service worker via Chrome messages; wraps LanguageModel API
- `index.ts` - Wires model, view, browser deps; cleanup on pagehide

**Shared Contracts (`src/shared/`):**
- `types.ts` - TaskPhase, TabSnapshot, ExistingGroup, PreparedTask, PlannedGroup, ExecutionSummary, TaskState
- `messages.ts` - OrganizerRequest discriminated union with type guard

**AI Adapter (`src/ai/`):**
- `language-model.ts` - `withLanguageModel` (guaranteed destroy in finally), `promptWithTimeout` (15s AbortController), error types (ModelUnavailableError, ModelTimeoutError)

### Key Design Patterns

**Seed/Continuation Orchestration:**
- Seed batch (first 50 tabs): Model creates initial categories from existing groups
- Continuation batches: Model assigns tabs to established categories
- 60-second hard deadline; partial results returned on continuation failure
- Fallback to domain-based grouping if seed fails or model unavailable

**Privacy-First Design:**
- No host_permissions in manifest
- URL sanitization removes credentials, query params, fragments
- TaskState stores only metadata (tab counts, phases) - no titles, URLs, or model outputs
- Alias system (T1/T2/T3) prevents raw data exposure to model

**Window-Level Task Locks:**
- One task per window at a time
- 120-second TTL prevents abandoned locks
- Owner token validation prevents cross-panel interference
- `toStoredState()` whitelist strips sensitive data before persistence

**TypeScript Strictness:**
- `strict: true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- All array access requires bounds checking
- Optional properties must use `?` (no `undefined` values)

## Testing

18 test files covering domain logic, orchestrator, Chrome adapters, and privacy guarantees.

**Test Environment:** Node with Vitest (no jsdom needed - pure logic is testable without DOM)

**Key Test Files:**
- `tests/privacy.test.ts` - Validates no host_permissions, no http/https in source, no CSP violations
- `tests/build-output.test.ts` - Validates dist/ contains required files (runs separately via `npm run test:build`)
- `tests/helpers/fake-chrome.ts` - Mock helpers for Chrome APIs

**Testing Approach:**
- Pure domain logic tested without mocks (batching, validation, URL sanitization)
- Chrome adapters tested with fake Chrome APIs
- Orchestrator tested with mock classify function

## Chrome Extension Loading

1. Requires Chrome 138+ (for LanguageModel API)
2. Build: `npm run build`
3. Open `chrome://extensions`, enable Developer mode
4. Click "Load unpacked" and select the `dist/` directory
5. Open 2+ unpinned, ungrouped tabs and click the extension icon

## Performance Constraints

- Target: 800ms for prewarmed model + small batch (non-blocking)
- Hard limits: 15 seconds per batch, 60 seconds per task
- Model timeout: 15 seconds (AbortController in `promptWithTimeout`)

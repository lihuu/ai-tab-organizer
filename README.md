# AI Tab Organizer

A Chrome extension that uses Chrome's built-in on-device AI (Gemini Nano) to intelligently organize browser tabs into meaningful groups. This project serves as a practical test bed for Chrome's Prompt API and demonstrates the capabilities of local AI for browser automation.

## 🎯 Purpose

This project is designed to **test and demonstrate Chrome's on-device Language Model API**. It showcases how local AI can be used for browser automation tasks while maintaining complete privacy - no data ever leaves your device.

### Why This Project?

Chrome's built-in AI represents a paradigm shift in browser capabilities:
- **Privacy-first**: All processing happens locally on your device
- **Zero latency**: No network round-trips for AI inference
- **Always available**: Works offline, no API keys needed
- **Cost-free**: No per-request charges

This extension tests these capabilities in a real-world scenario: organizing browser tabs intelligently.

## ✨ Features

### Core Features

- **🤖 AI-Powered Grouping**: Uses Chrome's built-in Gemini Nano model to analyze tab content and create semantic groups
- **🔒 Privacy-First**: All processing happens locally on your device - no data sent to external servers
- **🌐 Smart Mode**: Intelligently adds tabs to existing groups or creates new ones based on content similarity
- **🛡️ Fallback Mode**: Domain-based grouping when AI is unavailable
- **⚡ Fast & Efficient**: Optimized for real-time browser use with 15-second batch timeout
- **🎨 User-Friendly**: Clean side panel UI with real-time progress updates
- **🔄 Continuation Mode**: Handles unlimited tabs with 50-tab batches
- **🎯 Structured Output**: JSON schema ensures consistent AI responses

### Advanced Features

- **Window-Level Task Locks**: Prevents concurrent tasks in same window (120s TTL)
- **Owner Token Validation**: Prevents cross-panel interference
- **Domain-Diverse Batching**: Round-robin by registrable domain for better AI context
- **Group Name Normalization**: Handles CJK (10 chars) and Latin (20 chars) names
- **Tab Revalidation**: Ensures tabs still exist and are ungrouped before grouping
- **Best-Effort Execution**: Continues on partial failures

## 🧪 Testing Chrome's On-Device AI

This extension serves as a comprehensive test bed for Chrome's Prompt API:

### What We're Testing

1. **Model Capabilities**: Can Gemini Nano understand tab titles and URLs to create meaningful categories?
2. **Performance**: How fast is on-device inference for tab classification?
3. **Accuracy**: Does the AI produce reasonable groupings compared to domain-based fallback?
4. **Language Support**: Testing with English prompts and structured JSON output
5. **Error Handling**: Graceful fallback when model is unavailable or fails
6. **Batch Processing**: Handling 50+ tabs with continuation mode
7. **Structured Output**: JSON schema compliance and validation
8. **Real-World Scenarios**: Mixed domains, ambiguous titles, existing groups

### Test Scenarios

The extension handles various scenarios:

#### Scenario 1: Mixed Development Tabs
```
Input: 14 tabs
- GitHub: vscode, react, tensorflow (3 tabs)
- Google: search, maps, calendar (3 tabs)
- YouTube: video, trending (2 tabs)
- News: hacker news, bbc (2 tabs)
- Docs: MDN, Chrome Dev (2 tabs)
- Other: netflix (1 tab)

Expected AI Output:
✅ "Development & Programming" (4 tabs)
✅ "Google Productivity" (3 tabs)
✅ "Video & Entertainment" (3 tabs)
✅ "News & Reading" (2 tabs)
✅ "Developer Documentation" (2 tabs)
```

#### Scenario 2: Same Domain, Different Content
```
Input: 5 GitHub repos
- microsoft/vscode
- facebook/react
- tensorflow/tensorflow
- vuejs/vue
- angular/angular

Expected AI Output:
✅ "Frontend Frameworks" (react, vue, angular)
✅ "Developer Tools" (vscode)
✅ "Machine Learning" (tensorflow)
```

#### Scenario 3: Ambiguous Tabs
```
Input: Generic titles
- "Home" (multiple domains)
- "Dashboard" (multiple domains)
- "Login" (multiple domains)

Expected Behavior:
- AI uses URL context to disambiguate
- Fallback groups by domain if AI uncertain
```

### Expected Results

| Mode | Grouping Strategy | Best For |
|------|------------------|----------|
| **AI Mode** | Semantic similarity | Mixed content, meaningful categories |
| **Fallback Mode** | Domain-based | Same-domain tabs, clear domain patterns |
| **Hybrid** | AI + domain rules | Complex scenarios (future enhancement) |

## 🚀 Installation

### Prerequisites

- **Chrome 138 or later** (required for LanguageModel API)
- **Node.js 18+** (for building from source)

### Step 1: Enable Chrome's Experimental AI Features

1. Navigate to `chrome://flags`
2. Search for and enable:
   - ✅ `Prompt API for Gemini Nano`
   - ✅ `Summarization API` (optional)
3. **Restart Chrome** completely

### Step 2: Download the AI Model

1. Navigate to `chrome://components`
2. Find **"Optimization Guide On Device Model"**
3. Click **"Check for update"**
4. Wait for download to complete (may take 5-30 minutes, ~1GB)
5. Refresh the page to verify status shows "Up to date"

### Step 3: Verify AI Availability

Open Chrome DevTools Console (F12) and run:
```javascript
await LanguageModel.availability()
```
Expected output: `"available"` or `"downloadable"`

### Step 4: Load the Extension

#### Option A: From Source (Recommended for Testing)

```bash
# Clone repository
git clone https://github.com/lihuu/ai-tab-organizer.git
cd ai-tab-organizer

# Install dependencies
npm install

# Build for production
npm run build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select the dist/ directory
```

#### Option B: Quick Test (Pre-built)

```bash
# After cloning, just build
npm install
npm run build

# Load dist/ folder in Chrome
```

### Step 5: Test the Extension

1. Open 3+ unpinned, ungrouped tabs (e.g., github.com, google.com, youtube.com)
2. Click the extension icon in the toolbar
3. Or press `Alt+Shift+G` (Windows/Linux) / `Option+Shift+G` (Mac)
4. Watch the side panel for grouping progress

## 📖 How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Side Panel (UI Layer)                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  State Machine: idle → needs-setup → downloading │  │
│  │  → running → completed/failed                    │  │
│  └──────────────────────────────────────────────────┘  │
│  - User interface (English)                             │
│  - Progress display                                     │
│  - Auto-start when model available                      │
└────────────────────┬────────────────────────────────────┘
                     │ Chrome messages
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Background Service Worker (Chrome Layer)       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TaskStore: Window-level locks (120s TTL)        │  │
│  │  TabSource: Query tabs/groups from Chrome API    │  │
│  │  GroupExecutor: Create/update tab groups         │  │
│  └──────────────────────────────────────────────────┘  │
│  - Message routing (5 message types)                    │
│  - Owner token validation                               │
│  - Keyboard shortcut handler                            │
└────────────────────┬────────────────────────────────────┘
                     │ Direct API calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Chrome LanguageModel API                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Gemini Nano (On-Device)                         │  │
│  │  - Local inference (no network)                  │  │
│  │  - Privacy-preserving                            │  │
│  │  - 15-second timeout                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Grouping Workflow

#### Phase 1: Preparation
```
1. User clicks extension icon
2. Side panel opens, checks model availability
3. If available → run AI mode
4. If downloading → show progress, wait for user click
5. If unavailable → run fallback mode
```

#### Phase 2: Task Preparation
```
1. Query all tabs in current window
2. Filter: exclude pinned tabs, already-grouped tabs
3. Apply aliases: T1, T2, T3... (privacy protection)
4. Create domain-diverse batches (50 tabs per batch)
5. Claim window-level task lock (120s TTL)
```

#### Phase 3: AI Classification (Seed Batch)
```
Input to AI:
{
  "tabs": [
    {"alias": "T1", "title": "vscode", "host": "github.com"},
    {"alias": "T2", "title": "react", "host": "github.com"},
    ...
  ],
  "existingGroups": [
    {"alias": "G1", "title": "Development"}
  ]
}

AI Prompt:
"Analyze the tabs and create 3-5 meaningful categories.
Look at tab titles, URLs, and domains to identify themes.
Group similar tabs together."

Expected Output:
[
  {"groupName": "Development", "tabAliases": ["T1", "T2"]},
  {"groupName": "Productivity", "tabAliases": ["T3", "T4"]},
  ...
]
```

#### Phase 4: Continuation Batches
```
For remaining tabs (50 per batch):
1. Send tabs to AI with established categories
2. AI assigns tabs to existing categories only
3. Validate output (filter unknown aliases, deduplicate)
4. Merge assignments
5. Repeat until all tabs processed or 60s timeout
```

#### Phase 5: Execution
```
1. Revalidate tabs (still exist, ungrouped, same window)
2. For each planned group:
   a. Check if group with same name exists
   b. If yes → add tabs to existing group
   c. If no → create new group with random color
3. Update task state with execution summary
4. Release task lock
```

### Privacy Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| **No host_permissions** | Cannot access arbitrary websites |
| **No external requests** | All processing is local, no fetch/XHR |
| **URL sanitization** | Strips credentials, query params, fragments |
| **Metadata-only storage** | Task state stores counts, not content |
| **Alias system** | Uses T1/T2/T3 instead of real tab data |
| **Whitelist persistence** | `toStoredState()` strips sensitive data |

### Data Flow Example

```
Original Tab:
  URL: https://user:pass@github.com/microsoft/vscode?tab=readme#install
  Title: "microsoft/vscode: Visual Studio Code"

After Sanitization:
  URL: github.com/microsoft/vscode (2 path segments, 80 chars max)
  Title: "microsoft/vscode: Visual Studio Code" (not stored)

Sent to AI:
  {"alias": "T1", "host": "github.com", "path": "microsoft/vscode"}
  
Stored in TaskState:
  {phase: "running", processedTabs: 5, totalTabs: 14}
  (no titles, URLs, or AI responses stored)
```

## 🛠️ Development

### Project Structure

```
ai-tab-organizer/
├── src/
│   ├── ai/                        # Chrome LanguageModel API wrapper
│   │   └── language-model.ts      # withLanguageModel, promptWithTimeout
│   │
│   ├── background/                # Service worker (Chrome adapters)
│   │   ├── index.ts               # Message routing, shortcut handler
│   │   ├── group-executor.ts      # Creates/updates tab groups
│   │   ├── tab-source.ts          # Queries tabs from Chrome API
│   │   └── task-store.ts          # Window-level task management
│   │
│   ├── domain/                    # Pure business logic (testable)
│   │   ├── aliases.ts             # Generate T1/T2/T3, G1/G2/G3 aliases
│   │   ├── batching.ts            # Domain-diverse batch creation (PSL)
│   │   ├── candidates.ts          # Filter pinned/grouped tabs
│   │   ├── fallback.ts            # Domain-based fallback grouping
│   │   ├── group-name.ts          # Normalize group names (CJK/Latin)
│   │   ├── model-output.ts        # Validate AI output, enforce constraints
│   │   ├── prompts.ts             # System prompt, batch prompt builders
│   │   └── url.ts                 # URL sanitization
│   │
│   ├── organizer/                 # Orchestration logic
│   │   └── organize.ts            # Seed/continuation workflow (60s deadline)
│   │
│   ├── sidepanel/                 # UI layer
│   │   ├── index.ts               # Entry point, wiring
│   │   ├── model.ts               # State machine (idle→running→completed)
│   │   ├── view.ts                # Render UI with English labels
│   │   ├── browser-deps.ts        # Chrome API bridge, message passing
│   │   └── styles.css             # UI styling
│   │
│   ├── shared/                    # Type definitions & contracts
│   │   ├── types.ts               # TaskPhase, TabSnapshot, PlannedGroup, etc.
│   │   └── messages.ts            # OrganizerRequest discriminated union
│   │
│   └── types/
│       └── chrome-ai.d.ts         # LanguageModel API type declarations
│
├── tests/                         # 18 test files, 66 tests
│   ├── domain/                    # Pure logic tests
│   ├── organizer/                 # Orchestrator tests
│   ├── background/                # Chrome adapter tests
│   ├── helpers/                   # Fake Chrome API helpers
│   ├── privacy.test.ts            # Privacy guarantee tests
│   └── build-output.test.ts       # Build validation tests
│
├── public/
│   └── manifest.json              # Chrome extension manifest (MV3)
│
├── sidepanel.html                 # Side panel HTML entry
│
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript strict config
├── vite.config.ts                 # Multi-entry Vite build
├── vitest.config.ts               # Test configuration
└── README.md                      # This file
```

### Commands

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

### Key Design Patterns

#### 1. Pure Domain Logic + Chrome Adapters
```typescript
// Pure domain logic (testable without Chrome)
export function createBatches<T>(tabs: T[], batchSize: number): T[][] {
  // Round-robin by registrable domain
}

// Chrome adapter (wraps domain logic)
export class ChromeTabSource {
  async prepare(windowId: number): Promise<PreparedTask> {
    const tabs = await chrome.tabs.query({ windowId });
    return createBatches(filterTabs(tabs), 50);
  }
}
```

#### 2. Seed/Continuation Orchestration
```typescript
// Seed batch: Create categories from existing groups
const seedResult = await classify({
  mode: "seed",
  tabs: batches[0],
  categories: existingGroups
});

// Continuation batches: Assign to established categories
for (let i = 1; i < batches.length; i++) {
  await classify({
    mode: "continuation",
    tabs: batches[i],
    categories: seedResult.categories  // Fixed set
  });
}
```

#### 3. Window-Level Task Locks
```typescript
class TaskStore {
  async claim(windowId: number, ownerToken: string): Promise<ClaimResult> {
    // Check if another task is running (120s TTL)
    // Validate owner token
    // Return acquired: true/false
  }
}
```

### Testing Strategy

```typescript
// Pure domain logic: No mocks needed
test("createBatches creates domain-diverse batches", () => {
  const tabs = [
    { alias: "T1", host: "github.com" },
    { alias: "T2", host: "google.com" },
    { alias: "T3", host: "github.com" },
  ];
  const batches = createBatches(tabs, 50);
  expect(batches[0]).toHaveLength(3);
});

// Chrome adapters: Fake Chrome API
test("GroupExecutor creates new groups", async () => {
  const fakeChrome = createFakeChrome();
  const executor = new GroupExecutor(fakeChrome);
  await executor.execute(1, [{ title: "Dev", tabIds: [1, 2] }]);
  expect(fakeChrome.tabGroups.create).toHaveBeenCalled();
});

// Orchestrator: Mock classify function
test("organizeTabs falls back on seed failure", async () => {
  const result = await organizeTabs(input, {
    classify: () => Promise.reject(new Error("model-failed")),
    now: Date.now
  });
  expect(result.mode).toBe("fallback");
});
```

## 📊 Performance

### Benchmarks

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| **Prewarmed model + small batch** | 800ms | ~1-2s | Non-blocking target |
| **Single batch (50 tabs)** | 15s | ~5-10s | Hard timeout |
| **Full task (all tabs)** | 60s | ~30-45s | Hard deadline |
| **Model download** | N/A | ~1GB | One-time, first use |

### Optimization Techniques

1. **Domain-Diverse Batching**: Ensures AI sees variety, better categorization
2. **Prewarming**: Model loads on first use, subsequent calls faster
3. **Streaming Progress**: UI updates in real-time, doesn't block
4. **Parallel Validation**: Tab revalidation runs in parallel
5. **Early Exit**: Stops on 60s timeout, returns partial results

## 🔍 Debugging

### Enable Debug Logging

Open Chrome DevTools Console (F12) in the side panel:

```javascript
// Logs show:
[SidePanel] Running AI mode
[Organizer] Starting with 14 tabs
[Organizer] Created 1 batches
[Organizer] Raw AI response: [
  {"groupName": "Development", "tabAliases": ["T1", "T2", "T3"]},
  {"groupName": "Productivity", "tabAliases": ["T4", "T5"]},
  ...
]
[Organizer] Validated groups: 4
[Organizer] AI mode complete, created 4 groups
[SidePanel] AI mode completed successfully
```

### Common Issues

#### Issue: "Unable to create a text session because the service is not running"
**Solution:**
1. Check Chrome version: `chrome://settings/help` (need 138+)
2. Enable flags: `chrome://flags` → "Prompt API for Gemini Nano"
3. Download model: `chrome://components` → "Optimization Guide On Device Model"
4. Restart Chrome

#### Issue: "No output language was specified"
**Solution:**
- Ensure `expectedOutputs: [{ type: "text", languages: ["en"] }]` is set in `api.create()`
- This is already fixed in the latest code

#### Issue: AI creates only 1 group
**Solution:**
- Check prompt quality (see `src/domain/prompts.ts`)
- Verify tab diversity (different domains/titles)
- Check validation logic (see `src/domain/model-output.ts`)

#### Issue: Tabs not grouped
**Solution:**
- Check if tabs are pinned (excluded)
- Check if tabs already in a group (excluded)
- Check Console for errors
- Verify task lock not held by another panel

### Inspect Service Worker

1. Open `chrome://extensions`
2. Find "AI Tab Organizer"
3. Click "Inspect views" → "service worker"
4. Check Console for background script logs

## 🐛 Known Limitations

| Limitation | Reason | Workaround |
|------------|--------|------------|
| **Chrome 138+ required** | LanguageModel API is experimental | Update Chrome |
| **Model download ~1GB** | Gemini Nano is large | Wait for download, works offline after |
| **English optimized** | Prompt tuned for English | Modify prompts for other languages |
| **Ambiguous tabs** | Generic titles hard to classify | Uses URL context, fallback to domain |
| **Single window** | One task per window at a time | Wait for current task to finish |
| **15s batch timeout** | Prevents hangs | Partial results returned on timeout |
| **Max 5 groups** | AI constraint | Adjust in `validateModelOutput` |
| **No regrouping** | Already-grouped tabs skipped | Ungroup tabs first, then reorganize |

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

This is a test project for Chrome's on-device AI. Contributions welcome!

### How to Contribute

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make changes** and add tests
4. **Run verification**: `npm run verify`
5. **Commit**: `git commit -m "feat: add my feature"`
6. **Push**: `git push origin feature/my-feature`
7. **Open a Pull Request**

### Contribution Ideas

- [ ] Add hybrid mode (AI + domain rules)
- [ ] Support multiple languages
- [ ] Add user feedback mechanism (thumbs up/down)
- [ ] Implement regrouping option
- [ ] Add keyboard shortcuts for group management
- [ ] Create configuration UI for AI parameters
- [ ] Add export/import for group presets
- [ ] Improve batch diversity algorithm
- [ ] Add performance metrics dashboard

## 🔗 Resources

### Official Documentation
- [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in)
- [LanguageModel API](https://developer.chrome.com/docs/ai/language-model)
- [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/mv3)

### Related Projects
- [Chrome AI Examples](https://github.com/GoogleChromeLabs/chrome-ai-examples)
- [Gemini Nano Demos](https://developer.chrome.com/docs/ai/demos)

### Tools Used
- [Vite](https://vitejs.dev/) - Build tool
- [Vitest](https://vitest.dev/) - Testing framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [tldts](https://github.com/remusao/tldts) - Public Suffix List

## 📈 Roadmap

### v0.1.0 (Current)
- ✅ AI-powered tab grouping
- ✅ Domain-based fallback
- ✅ Privacy-first design
- ✅ English UI
- ✅ Debug logging

### v0.2.0 (Planned)
- [ ] Hybrid grouping mode
- [ ] User feedback system
- [ ] Performance metrics
- [ ] Configuration options

### v0.3.0 (Future)
- [ ] Multi-language support
- [ ] Regrouping capability
- [ ] Group presets
- [ ] Export/import functionality

---

## 🙏 Acknowledgments

- **Chrome AI Team**: For building the LanguageModel API
- **Gemini Nano**: For on-device AI capabilities
- **Chrome Extensions Team**: For MV3 architecture

---

**Note**: This extension is for testing and demonstration purposes. It showcases the capabilities of Chrome's on-device AI for browser automation tasks. All processing happens locally - your tab data never leaves your device.

**Built with ❤️ for testing Chrome's on-device AI**

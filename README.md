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

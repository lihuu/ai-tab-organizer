# AI Tab Organizer V1 Manual Test Checklist

Environment:

- Chrome version:
- Operating system:
- Prompt API availability:

## Trigger and model lifecycle

- [ ] Action click opens the Side Panel and starts automatically when available.
- [ ] `Alt+Shift+G` opens the Side Panel for the focused window.
- [ ] `downloadable` shows "准备本地 AI" and waits for a click.
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

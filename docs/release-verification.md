# SnapIssue MVP Release Verification

## Automated Checks

- `npm run typecheck`
- `npm test`
- `npm run build`
- `find dist -name '*.map' -print`
- Secret scans over source, package files, README, and `dist/`

## Browser Smoke Paths

- Load `dist/` as an unpacked Chromium extension.
- Open popup and confirm compact light/dark UI, setup status, focus rings, capture action, and settings action.
- Open options and confirm GitHub, targeting, R2, and privacy warning settings render in light/dark mode.
- Start capture on a normal page, create a context-only issue with mocked or safe test GitHub settings, and confirm success toast with `View issue`.
- Capture one screenshot, crop it, add more screenshots up to five, reorder, remove, retake, and submit.
- Confirm protected browser/extension pages show the launcher failure state.
- Confirm missing GitHub/R2 settings keep the draft open with a retryable error.
- Confirm R2 upload failure preserves the created issue and shows partial success.
- Confirm GitHub body update failure offers `Copy links`.
- Confirm cancel, Escape, pagehide/reload, and URL change remove the overlay and prevent stale submit.

## Human Review

- Final MVP visual signoff must be done in Chromium after loading `dist/`.

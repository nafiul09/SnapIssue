# SnapIssue Product Spec

## Summary

SnapIssue is a local-first Chromium extension for creating GitHub issues quickly from any website. The primary workflow is: press a shortcut or click the extension, click the point on the page that needs attention, review the screenshot, write a title and description, choose a GitHub owner/repo and labels, then create the issue.

The extension is for personal and small-team internal use. It is not intended for public marketplace distribution in the MVP.

## Goals

- Create GitHub issues fast from the current browser page.
- Capture the visible viewport with a clear click marker.
- Support one to five screenshots per issue.
- Upload screenshots to Cloudflare R2 and embed public image URLs in GitHub issue bodies.
- Use each user's own GitHub fine-grained personal access token.
- Keep all credentials and drafts local to the browser.
- Provide a polished, compact, non-generic UI that follows system light/dark mode.

## Non-Goals For MVP

- No OAuth flow.
- No server or proxy.
- No GitHub Enterprise Server support.
- No issue browsing.
- No comments on existing issues.
- No duplicate issue detection.
- No assignees, milestones, or projects.
- No full-page screenshot stitching.
- No automatic or manual redaction.
- No mobile browser support.
- No local history of created issues.

## Platform

- Chromium extension.
- Manifest V3.
- Desktop Chromium browsers such as Chrome, Brave, Edge, Arc, and Vivaldi.
- Production builds are bundled, minified, and do not include source maps.
- The extension is loaded locally from `dist/`.

## Suggested Project Structure

```text
experiments/snapissue/
  src/
    background/
    content/
    popup/
    options/
    shared/
  manifest.json
  package.json
  vite.config.ts
```

## Extension Permissions

MVP should use temporary page access through `activeTab`.

Expected permissions:

```json
[
  "activeTab",
  "scripting",
  "storage",
  "tabs",
  "commands",
  "clipboardWrite"
]
```

No persistent `<all_urls>` host access for MVP.

## Authentication And Configuration

### GitHub

- Each user configures their own fine-grained GitHub PAT.
- The token is stored in `chrome.storage.local`.
- The token is validated immediately when saved.
- On validation, the extension calls GitHub `/user` and stores the authenticated `login`.
- OAuth is explicitly out of scope for MVP.
- Required GitHub permissions:
  - `Metadata: Read`
  - `Issues: Read and write`
- The same token is used for issue creation and label creation.
- No `Contents` permission is required because images are uploaded to R2.

### Cloudflare R2

- R2 is shared infrastructure, but configured locally in each user's browser.
- R2 settings are entered or imported in the extension options UI.
- R2 credentials are never committed into source code.
- R2 settings import/export is for R2 only, not GitHub tokens.
- Team R2 setup JSON may include the secret key, with a clear warning.
- R2 token must be scoped to the dedicated screenshot bucket.
- Screenshots are public by link.
- Bucket listing should not be public.

R2 settings:

- account ID
- bucket name
- access key ID
- secret access key
- public base URL or custom domain

## Repo Access

- The GitHub token defines the repo boundary.
- Only repos accessible through the PAT are shown.
- Repos that cannot create issues are hidden from the normal picker.
- Archived repos are hidden by default.
- Repos with issues disabled are hidden.
- Repo access is cached after token validation or manual refresh.
- No forced refresh on every capture.

## Owner And Repo Selection

- Account/owner and repo are two separate custom searchable selects.
- Account means repo owner namespace:
  - the authenticated user's personal namespace
  - organizations that own repos available through the PAT
- Repo select shows only eligible repos under the selected owner.
- Last successful owner/repo is remembered.
- First run has no selected owner/repo.
- Private/public status is differentiated with subtle icons.

## Labels

- Labels are part of MVP.
- Existing labels are fetched for the selected repo.
- Users can select one or multiple labels.
- Users can create a new label from the extension if permitted.
- New labels receive an auto-generated color.
- Label creation failure should not break the whole issue creation flow unless the selected label is required for submission.

## Popup

The popup is intentionally minimal.

It contains:

- GitHub/R2 setup status.
- Last selected repo indicator.
- Primary action: `Capture Issue`.
- Secondary action: `Settings`.

The popup is not the main issue form.

## Capture Flow

Default shortcut:

```text
Alt+Shift+I
```

Users may change the shortcut through Chromium extension shortcut settings.

Flow:

1. User presses shortcut or clicks `Capture Issue`.
2. Extension injects a content overlay into the active tab.
3. All page interaction is disabled through a top-layer capture overlay.
4. Cursor changes to crosshair.
5. User clicks the point of interest.
6. Extension captures the visible viewport only.
7. The click marker is drawn into the captured image.
8. Issue form opens inside the current website as an injected overlay.

Protected pages such as `chrome://`, `chrome-extension://`, Chrome Web Store pages, and other browser internal pages show a graceful unavailable message.

Iframe pixels visible in the viewport are captured, but there is no special iframe DOM handling.

## Screenshot Marker

- Ring marker centered on the clicked point.
- 28px diameter.
- 3px stroke.
- No fill.
- Default marker color: `#ef4444`.
- Add a subtle white or black contrast outline when useful.
- Marker is baked into the image before crop.

## Screenshot Rules

- Visible viewport only.
- Screenshot format: WebP.
- Use high quality WebP, around `0.9`.
- Screenshot is stored locally only while the overlay is active.
- If popup/overlay closes, tab reloads, navigation happens, user cancels, or submission succeeds, draft state is cleared.
- Users can remove all screenshots and still create an issue with page context.

## Multiple Screenshots

- MVP supports up to five screenshots per issue.
- The screenshot strip has an add button.
- To add another screenshot:
  1. User clicks add.
  2. Modal temporarily hides.
  3. Capture overlay becomes active again.
  4. User clicks another point.
  5. New screenshot is added.
  6. Modal reopens.
- Screenshots can be reordered before submission.
- Each screenshot can be previewed, cropped, retaken, or removed.

## Crop

- Basic crop system is part of MVP.
- Crop happens inside the issue form as an optional edit step.
- Clicking the screenshot preview opens crop/preview UI.
- Default crop is the full screenshot.
- User can drag/resize a crop rectangle.
- User can reset crop.
- After applying crop, discard the original and keep only the cropped image state.
- If the user wants the full viewport again, they retake the screenshot.

## Issue Form

The form lives in the injected website overlay, isolated from page CSS.

Fields:

- owner/account select
- repo select
- title
- description editor
- screenshot strip
- label selector
- optional browser/OS context checkbox

Validation:

- GitHub token required.
- R2 settings required only if screenshots exist.
- owner/repo required.
- title required.
- screenshots optional.
- description optional but encouraged.

## Editor

- Local editor should feel WYSIWYG.
- Submission output is Markdown only.
- Tiptap can be used for the editor experience and Markdown output.
- Toolbar includes GitHub issue basics only:
  - bold
  - italic
  - inline code
  - code block
  - bullet list
  - numbered list
  - task list
  - link
  - quote
  - undo
  - redo
- No final issue preview step.

## Issue Body Format

The issue body is Markdown.

The user's description appears first. SnapIssue appends generated sections below it.

Suggested format:

```md
<user description>

## Screenshots

### Screenshot 1
![Screenshot 1](https://assets.example.com/captures/2026/05/nafiulislam/owner/repo/issues/123/capture-uuid.webp)

Click: x=512, y=284

## Context

- Page: https://example.com/current-page
- Title: Current Page Title
- Captured at: 2026-05-31 14:22:09
- Viewport: 1440x900
```

If enabled:

```md
- Environment: Chrome 126 on macOS
```

## Submit Flow

The selected behavior prioritizes issue creation even if screenshots fail.

1. Create the GitHub issue with:
   - title
   - user description
   - labels
   - page context
   - screenshot placeholder if screenshots exist
2. Upload screenshots to R2.
3. Update the issue body with final screenshot Markdown.

Failure behavior:

- If GitHub issue creation fails before screenshot upload, keep the draft open and show retry.
- If screenshot upload fails after issue creation, keep the issue created and show warning.
- If screenshot upload succeeds but GitHub body update fails, do not delete R2 screenshots.
- If screenshots upload but cannot be attached, offer to copy Markdown image links to clipboard.

## R2 Object Paths

Use the authenticated GitHub username as the uploader namespace.

Suggested path:

```text
captures/YYYY/MM/<github-user>/<owner>/<repo>/issues/<issue-number>/<uuid>.webp
```

Example:

```text
captures/2026/05/nafiulislam/acme/webapp/issues/123/8f97f7c2.webp
```

## R2 Upload Implementation

- Use `@aws-sdk/client-s3` for MVP.
- Configure the S3 client for Cloudflare R2's S3-compatible endpoint.
- Upload directly from the Manifest V3 background service worker.
- Do not write a custom SigV4 signer for MVP.
- Revisit a smaller signer only if bundle size becomes a real problem.

## Success And Error UI

On success:

- Close the issue modal.
- Show a top-center toast.
- Toast slides in from the top.
- Text: `Issue created`.
- Action: `View issue`.
- Bottom progress bar runs for 5 seconds.
- Clicking `View issue` opens the GitHub issue in a new tab and closes the toast.
- After the toast exits, all draft state is cleared.

If screenshots fail:

- Toast text should communicate partial success:
  - `Issue created, screenshots failed`
  - or `Issue created, screenshots not attached`
- Keep `View issue`.
- Show `Copy links` when R2 upload succeeded but GitHub body update failed.

## Sensitive Domain Warning

- R2 screenshots are public by link.
- Sensitive-domain warning is enabled by default.
- Warning is not a hard block.
- User can continue after confirmation.
- User can edit the warning list.
- No hard blocklist in MVP.

Default warning patterns:

```text
localhost
127.0.0.1
*.internal
*.admin
mail.google.com
bank
stripe.com
cloudflare.com
```

## UI And Styling

- Follow system theme.
- Support polished light and dark modes.
- Use Shadow DOM for content overlay isolation.
- Compact premium utility UI.
- Avoid marketing-page patterns.
- Avoid generic AI-style gradients.
- Use icons for common actions.
- Use strong focus states.
- Keep border radii at 8px or less unless a specific component needs otherwise.
- Avoid nested cards.

## Storage

Use `chrome.storage.local`.

Stored:

- GitHub token
- GitHub authenticated login
- R2 settings
- cached eligible repos
- cached labels
- last successful owner/repo
- UI preferences such as environment checkbox and sensitive-domain list

Not stored:

- created issue history
- screenshot history
- persistent drafts

## Security Notes

- Bundled extension code is inspectable after install, even if minified.
- Do not hardcode secrets in source or build output.
- Do not use `chrome.storage.sync` for credentials.
- Do not log tokens, R2 secrets, or signed headers.
- Do not include secrets in error messages.
- Provide clear credential clearing controls.
- Recommend fine-grained GitHub PATs scoped only to selected repos.
- Recommend bucket-scoped R2 credentials that can be rotated.

## Open Questions

- How to package Tiptap and crop UI without bloating the extension.
- Exact visual design tokens for light/dark themes.
- Exact GitHub API strategy for verifying issue-write access before showing repos.
- How to test private GitHub issue rendering of public R2 WebP URLs across browsers.

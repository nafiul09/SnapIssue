# SnapIssue PRD

Label for issue tracker publication: `ready-for-agent`

## Problem Statement

Creating high-quality GitHub issues from a browser page is slower than it should be. The user often needs to capture the current website state, mark the exact point of concern, crop or organize screenshots, choose the correct GitHub owner/repo, add labels, include page context, and then manually paste everything into GitHub. That workflow creates friction, especially when the goal is to file issues quickly while browsing or testing.

The user wants a local-first Chromium extension that turns the current page into a GitHub issue capture surface. It should use the user's own fine-grained GitHub token, upload screenshots to a shared Cloudflare R2 bucket, and create clean GitHub issues without a backend, OAuth app, or public marketplace publishing.

## Solution

Build SnapIssue, a Manifest V3 Chromium extension that starts issue capture from a shortcut or minimal popup. When activated, SnapIssue injects a Shadow DOM overlay into the active tab, disables page interaction, lets the user click the point of interest, captures the visible viewport with a clear ring marker, and opens an in-page issue form.

The issue form lets the user choose an owner and repo from cached PAT-accessible repositories, write a title and Markdown-compatible WYSIWYG description, add labels, crop/reorder up to five WebP screenshots, and create a GitHub issue. Screenshots are uploaded directly from the extension to Cloudflare R2 through the S3-compatible API, then embedded into the GitHub issue body through the official GitHub REST API.

Configuration remains local to the user's browser. Each user supplies their own GitHub fine-grained PAT. R2 settings can be imported as JSON for team convenience, but no secrets are committed to source code or shipped in the extension bundle.

## User Stories

1. As a browser user, I want to start issue capture from a keyboard shortcut, so that I can create issues without interrupting my workflow.
2. As a browser user, I want to start issue capture from the extension popup, so that I have a visible fallback when I do not remember the shortcut.
3. As a browser user, I want the popup to stay minimal, so that the extension does not become a slow secondary app.
4. As a browser user, I want page interaction disabled during capture, so that I do not accidentally click links or change page state.
5. As a browser user, I want the cursor to make capture mode obvious, so that I know the next click will select the screenshot point.
6. As a browser user, I want to click the exact point of interest, so that the created issue identifies the problem location.
7. As a browser user, I want SnapIssue to capture only the visible viewport, so that capture is fast and predictable.
8. As a browser user, I want the clicked point marked with a crisp ring, so that reviewers can see what I meant without guessing.
9. As a browser user, I want the marker to avoid covering the UI, so that the screenshot remains readable.
10. As a browser user, I want the issue form to open on top of the website, so that I remain in the context where I found the issue.
11. As a browser user, I want the overlay UI isolated from website CSS, so that arbitrary sites do not break SnapIssue's interface.
12. As a browser user, I want the overlay to follow my system theme, so that it feels native in light and dark environments.
13. As a browser user, I want the UI to feel premium and compact, so that the tool feels intentional rather than generic.
14. As a browser user, I want to crop a screenshot before upload, so that I can focus the issue on the relevant area.
15. As a browser user, I want cropping to be optional, so that the fastest path remains available.
16. As a browser user, I want to reset a crop, so that I can recover from a bad crop choice before applying it.
17. As a browser user, I want the original screenshot discarded after applying crop, so that local draft memory stays lower and the final image is unambiguous.
18. As a browser user, I want to retake a screenshot, so that I can replace a bad capture.
19. As a browser user, I want to remove screenshots, so that I can create a context-only issue when screenshots are unnecessary.
20. As a browser user, I want to add multiple screenshots to one issue, so that I can capture several related points without creating separate issues.
21. As a browser user, I want a maximum of five screenshots, so that the UI remains manageable and drafts do not become too heavy.
22. As a browser user, I want the modal to hide while taking another screenshot, so that the next capture does not include SnapIssue's own UI.
23. As a browser user, I want to reorder screenshots, so that the final issue presents evidence in the right sequence.
24. As a browser user, I want screenshots exported as WebP, so that uploaded assets stay smaller while remaining readable.
25. As a browser user, I want screenshots kept only during the active draft, so that abandoned data does not persist in my browser.
26. As a browser user, I want drafts cleared when the overlay closes, so that stale screenshots are not retained.
27. As a browser user, I want drafts cleared when the tab reloads or navigates, so that issue context does not become incorrect.
28. As a GitHub user, I want to paste my own fine-grained PAT, so that issue creation happens as me.
29. As a GitHub user, I want token validation when saving, so that I discover permission problems before creating an issue.
30. As a GitHub user, I want SnapIssue to show the authenticated GitHub username, so that I know which account the token represents.
31. As a GitHub user, I want only PAT-accessible repos shown, so that the picker reflects the actual token boundary.
32. As a GitHub user, I want repos without issue creation support hidden, so that I do not pick targets that cannot work.
33. As a GitHub user, I want archived repos hidden by default, so that stale repositories do not clutter the picker.
34. As a GitHub user, I want owner/account and repo as separate selectors, so that personal and organization repos are easy to navigate.
35. As a GitHub user, I want searchable custom selects, so that I can find the right owner/repo quickly.
36. As a GitHub user, I want private and public repos differentiated by icon, so that I avoid creating issues in the wrong visibility context.
37. As a GitHub user, I want the last successful owner/repo remembered, so that repeated issue creation is faster.
38. As a GitHub user, I want the first run to have no selected repo, so that I intentionally choose the first target.
39. As a GitHub user, I want repo access cached after token validation, so that capture does not wait on repo discovery every time.
40. As a GitHub user, I want a manual refresh for repo access, so that I can update the cache when token access changes.
41. As a GitHub user, I want to select existing labels, so that issues enter the repo with useful triage metadata.
42. As a GitHub user, I want to select multiple labels, so that one issue can represent several categories.
43. As a GitHub user, I want to create a missing label from the extension, so that I do not have to leave the flow for simple label setup.
44. As a GitHub user, I want new label colors generated automatically, so that label creation stays fast.
45. As a GitHub user, I want label creation to use the same token, so that I do not configure extra credentials.
46. As a GitHub user, I want no assignees, milestones, or projects in the MVP, so that the form stays focused on fast capture.
47. As a GitHub user, I want no issue browsing in the MVP, so that the extension remains optimized for creating new issues.
48. As a GitHub user, I want no comment flow in the MVP, so that SnapIssue does not become a GitHub client.
49. As a GitHub user, I want no duplicate detection in the MVP, so that issue creation remains fast and predictable.
50. As a GitHub user, I want the title focused and intentional, so that the final issue has a meaningful summary.
51. As a GitHub user, I want a WYSIWYG editor that submits Markdown, so that writing feels comfortable while GitHub receives native issue content.
52. As a GitHub user, I want only GitHub issue basics in the editor toolbar, so that the editor is useful but not bloated.
53. As a GitHub user, I want screenshots and context appended below my description, so that my written report remains primary.
54. As a GitHub user, I want one shared context section, so that the issue includes URL, title, timestamp, and viewport without clutter.
55. As a GitHub user, I want per-screenshot click coordinates, so that each capture can be interpreted accurately.
56. As a GitHub user, I want an optional browser/OS line, so that I can include environment context only when useful.
57. As a GitHub user, I want the browser/OS line off by default, so that issues avoid unnecessary personal/system details.
58. As a GitHub user, I want issue creation to proceed even if screenshots later fail, so that the main report is not lost.
59. As a GitHub user, I want screenshot links added by updating the issue body, so that the final issue remains a single clean report.
60. As a GitHub user, I want no automated comments, so that SnapIssue does not add comment noise.
61. As a GitHub user, I want uploaded screenshot links copied as a fallback when body update fails, so that I can paste them manually.
62. As a GitHub user, I want a success toast with a view action, so that I can confirm the issue and open it when needed.
63. As a GitHub user, I want the success toast to disappear after five seconds, so that the page returns to normal.
64. As a GitHub user, I want the `View issue` action to open a new tab, so that I can inspect the created issue without losing the source page.
65. As a user configuring SnapIssue, I want GitHub credentials stored locally, so that they do not sync across browsers.
66. As a user configuring SnapIssue, I want R2 settings stored locally, so that the extension can upload assets without a backend.
67. As a user configuring SnapIssue, I want R2 settings import/export as JSON, so that setup can be shared internally.
68. As a user configuring SnapIssue, I want R2 import to include the secret key when needed, so that team setup is fast.
69. As a user configuring SnapIssue, I want clear warnings around R2 secret imports, so that I understand the risk.
70. As a user configuring SnapIssue, I want GitHub token excluded from R2 imports, so that GitHub access remains personal.
71. As a user configuring SnapIssue, I want clear controls to clear GitHub and R2 credentials, so that I can rotate or remove access.
72. As a user configuring SnapIssue, I want no credentials hardcoded into the extension, so that source and builds do not leak team secrets.
73. As a user configuring SnapIssue, I want the extension to state that R2 images are public by link, so that I understand screenshot exposure.
74. As a user configuring SnapIssue, I want a sensitive-domain warning list, so that risky captures get a final confirmation.
75. As a user configuring SnapIssue, I want sensitive-domain warnings to be editable, so that I can adapt them to my workflow.
76. As a user configuring SnapIssue, I want warnings rather than hard blocks, so that local and admin testing remains possible.
77. As a user configuring SnapIssue, I want no automatic redaction, so that the extension does not give false confidence about sensitive content.
78. As a user configuring SnapIssue, I want no manual redaction in MVP, so that the first version keeps image editing simple.
79. As a user on a protected browser page, I want a graceful unavailable message, so that I understand why capture cannot start.
80. As a user viewing iframe content, I want visible iframe pixels captured normally, so that screenshots match what I see.
81. As a user viewing iframe content, I do not need iframe DOM inspection, so that the extension avoids unnecessary complexity.
82. As a project maintainer, I want production builds minified without source maps, so that local distribution feels like a bundled extension.
83. As a project maintainer, I want no secrets in source or build output, so that the extension bundle does not become a credential leak.
84. As a project maintainer, I want the extension loaded from a build output directory, so that installation is predictable.
85. As a project maintainer, I want a clear architecture around background, content, popup, options, and shared modules, so that future implementation work is easy to split.
86. As a project maintainer, I want deep modules for GitHub, R2, issue body generation, repo cataloging, screenshot processing, and draft orchestration, so that complex behavior can be tested without browser UI.
87. As a project maintainer, I want no GitHub Enterprise support in MVP, so that API assumptions stay simple.
88. As a project maintainer, I want no OAuth app in MVP, so that there is no server-side auth surface to manage.
89. As a project maintainer, I want direct R2 upload from the extension, so that the project remains serverless.
90. As a project maintainer, I want the AWS S3 SDK used for R2 uploads, so that SigV4 signing is reliable in the MVP.

## Implementation Decisions

- Build SnapIssue as a Manifest V3 Chromium extension using React, TypeScript, and Vite.
- Produce development builds with source maps and production builds without source maps.
- Minify production JavaScript and CSS.
- Use a minimal popup as the launcher and settings entry point.
- Use an injected in-page overlay as the real capture and issue creation UI.
- Isolate the in-page UI with Shadow DOM to avoid host-page CSS interference.
- Use temporary `activeTab` access for MVP instead of persistent all-site host permissions.
- Use the extension commands API for the default `Alt+Shift+I` shortcut.
- Block or gracefully reject unsupported protected browser pages.
- Implement a capture coordinator module that owns capture-mode lifecycle, overlay mounting, cancellation, tab navigation/reload cleanup, and modal hide/show behavior for additional screenshots.
- Implement a screenshot processing module that captures the visible viewport, draws the marker, exports WebP, applies crop, discards originals after crop, and returns final upload-ready blobs.
- Implement a draft state module that models one active issue draft per tab, supports up to five screenshots, enforces screenshot ordering, and clears state on cancel, close, navigation, reload, or successful completion.
- Implement a crop module that supports full-image default selection, draggable/resizable crop rectangle, reset, apply, and retake.
- Implement a GitHub API client module that validates PATs, fetches the authenticated user, lists accessible repositories, filters eligible issue targets, fetches labels, creates labels, creates issues, and updates issue bodies.
- GitHub support is limited to `github.com` and `https://api.github.com`.
- Each user provides a fine-grained GitHub PAT with `Metadata: Read` and `Issues: Read and write`.
- Store the authenticated GitHub login from `/user` and use it as the R2 uploader namespace.
- Implement a repo catalog module that caches eligible repos grouped by owner/account and supports manual refresh.
- Treat account/owner as the repo owner namespace, not as a separate authenticated identity.
- Use custom searchable owner and repo dropdowns.
- Show private/public repo visibility with subtle icons.
- Remember the last successful owner/repo only after a successful issue creation.
- Implement a label manager module that fetches labels for the selected repo, supports multi-select, and creates missing labels with generated colors.
- Do not include assignees, milestones, projects, issue browsing, comments, or duplicate detection in MVP.
- Implement the description editor as a local WYSIWYG Markdown-capable editor, with Markdown as the only submission format.
- Use Tiptap for the editor experience if it remains practical for bundle size and Markdown output.
- Limit editor toolbar controls to common GitHub issue formatting.
- Implement an issue body builder module that appends generated screenshots and context below the user's Markdown description.
- Include shared page context: URL, page title, capture timestamp, and viewport size.
- Include per-screenshot click coordinates.
- Include optional one-line browser/OS environment context when the user enables it.
- Implement an R2 uploader module using `@aws-sdk/client-s3` against Cloudflare R2's S3-compatible endpoint.
- Upload screenshots directly from the extension background service worker.
- Upload only final WebP screenshot assets.
- Use R2 object keys organized by year, month, authenticated GitHub user, target owner, target repo, issue number, and UUID.
- Make screenshots public by link through the configured R2 public base URL or custom domain.
- Create the GitHub issue before uploading screenshots, so the issue exists even if screenshot upload fails.
- After screenshots upload, update the issue body with final Markdown image links.
- If screenshot upload fails after issue creation, keep the issue and show a partial-success warning.
- If screenshot upload succeeds but the issue body update fails, do not delete R2 assets; offer to copy Markdown image links.
- Store GitHub token, R2 settings, repo cache, label cache, last successful repo, and UI preferences in local extension storage.
- Never use synced storage for credentials.
- Provide R2-only JSON import/export.
- Allow R2 import JSON to include the secret access key, with a strong warning.
- Do not include GitHub tokens in R2 import/export.
- Provide controls to clear credentials.
- Implement sensitive-domain warning patterns that are editable and enabled by default.
- Do not implement a hard blocklist.
- Do not implement automatic or manual screenshot redaction in MVP.
- Use a top-center success toast that slides from the top, includes `Issue created`, provides `View issue`, and displays a five-second progress bar.
- Show partial-success toast variants when screenshots fail or are not attached.
- Open created GitHub issues in a new tab from the toast action.
- Keep UI compact, premium, utility-focused, light/dark aware, and free of marketing-style layouts.

## Testing Decisions

- Tests should focus on externally observable behavior and stable module contracts rather than implementation details.
- The issue body builder should have unit tests for description-only issues, one screenshot, multiple screenshots, reordered screenshots, missing screenshots, optional environment context, and generated Markdown formatting.
- The R2 key builder should have unit tests for date grouping, GitHub username namespace, owner/repo path segments, issue number, UUID suffix, and WebP extension.
- The repo catalog should have tests for grouping by owner, filtering archived repos, filtering repos with issues disabled, preserving private/public metadata, and remembering the last successful repo only after success.
- The GitHub API client should have mocked integration tests for token validation, repo listing, label listing, label creation, issue creation, and issue body update failure behavior.
- The R2 uploader should have mocked tests around successful upload, upload failure, public URL generation, and ensuring secrets are not surfaced in returned errors.
- The screenshot processing module should have tests for marker drawing metadata, crop application, WebP export behavior, and original-discard semantics after crop.
- The draft state module should have tests for max five screenshots, add/remove/reorder behavior, cancel cleanup, submit cleanup, tab reload cleanup, and partial-success transitions.
- The sensitive-domain matcher should have tests for exact hosts, wildcard-like patterns, localhost, IP addresses, and non-matching domains.
- The settings import/export module should have tests for valid R2 imports, missing required fields, safe export behavior, full R2 export warning flow where applicable, and exclusion of GitHub tokens.
- The label color generator should have tests for valid GitHub label color format and deterministic or bounded output behavior if deterministic generation is chosen.
- The browser overlay should receive component/integration coverage for capture-mode messaging, unsupported-page display, crop modal opening, add-screenshot modal hiding, and toast actions.
- End-to-end browser tests should cover the core happy path against mocked GitHub and R2 endpoints: configure settings, capture screenshot, crop, choose repo, choose labels, create issue, upload screenshots, update body, and open success link.
- End-to-end browser tests should cover failure paths: missing token, missing R2 settings with screenshots, protected pages, R2 upload failure after issue creation, GitHub body update failure after R2 upload, and user cancellation cleanup.
- Existing codebase prior art is limited because SnapIssue is a new experiment in a loose personal-projects workspace. Tests should establish the local project standard rather than trying to mirror unrelated projects.

## Out of Scope

- Publishing to the Chrome Web Store.
- Mobile browser support.
- OAuth login.
- Any backend, proxy, or hosted service owned by SnapIssue.
- GitHub Enterprise Server.
- Persistent all-URL host access.
- Full-page screenshots.
- DOM element inspection.
- Cross-tab or multi-page issue drafts.
- Issue browsing.
- Commenting on existing issues.
- Assignees.
- Milestones.
- GitHub Projects.
- Duplicate issue detection.
- Local issue history.
- Persistent draft recovery.
- Automatic screenshot redaction.
- Manual blur/redaction tools.
- Rich issue preview step before submit.
- Uploading screenshots into the target GitHub repository.
- Using GitHub web UI attachment upload automation.
- Sharing GitHub tokens between users.
- Syncing credentials across browsers.

## Further Notes

- When published to the issue tracker, this PRD should receive the `ready-for-agent` label.
- The MVP security posture depends on user-scoped GitHub fine-grained PATs and bucket-scoped R2 credentials. Minification should not be treated as secret protection.
- R2 screenshots are public by link. The UI should make this clear before first upload and during sensitive-domain confirmations.
- WebP rendering in private GitHub issues should be verified using public R2 URLs before relying on the workflow for team use.
- The first implementation should favor reliable, testable deep modules over clever browser automation.

# SnapIssue

SnapIssue is a local-first Chromium extension for creating GitHub issues from the
current page, with optional annotated WebP screenshots uploaded to Cloudflare R2.

Project planning:

- [PRD.md](./PRD.md)
- [SPEC.md](./SPEC.md)

## MVP Features

- Capture the active tab from the extension popup or `Alt+Shift+I`.
- Block protected browser/extension pages with a clear error.
- Choose a cached GitHub owner/repo target and optional labels.
- Draft an issue in an overlay with a WYSIWYG Markdown editor.
- Add up to five screenshots, crop/preview/reset/retake/remove them, and reorder them.
- Upload WebP screenshots to Cloudflare R2 and attach public links to the GitHub issue.
- Handle success, partial screenshot failure, fallback screenshot links, and cancellation.
- Warn on configured sensitive domains and optionally include environment context.
- Store GitHub/R2 settings in local extension storage only.

## Setup

Build and load the unpacked extension from `dist/`:

```sh
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select this repo's `dist/` directory. Reload the unpacked extension after every
new build, especially when manifest permissions change.

### GitHub

Create a fine-grained personal access token at:

```text
https://github.com/settings/personal-access-tokens/new
```

Use repository access for the repos SnapIssue should target. Grant repository
permission **Issues: Read and write** so SnapIssue can create issues and manage
labels. Paste the token in SnapIssue settings, save it, then refresh repo access.

### Cloudflare R2

Create or choose a bucket for screenshots. Create an R2 S3 API token with Object
Read & Write access, scoped to that bucket when possible. In SnapIssue settings,
enter:

- Account ID
- Bucket name
- Access Key ID
- Secret Access Key
- Public base URL, such as an R2 public bucket URL or custom domain

Use **Test R2** in settings to upload a tiny dummy WebP, verify it, and delete it.
The test reports the generated public URL when the flow works.

## Usage

1. Open a normal `http`, `https`, or `file` page.
2. Click the SnapIssue extension action and choose **Capture Issue**, or press
   `Alt+Shift+I`.
3. Click the point on the page you want to mark.
4. Fill in title, description, target repo, labels, and screenshot options.
5. Submit to create the GitHub issue.

SnapIssue hides its own capture UI before taking screenshots, so the overlay and
processing banner are not included in the final image.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

Production builds are emitted to `dist/` without source maps.

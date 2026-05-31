const SNAPISSUE_CONTENT_START_CAPTURE = "snapissue:content-start-capture";
const SNAPISSUE_CREATE_CONTEXT_ISSUE = "snapissue:create-context-issue";
const HOST_ID = "snapissue-overlay-host";
const STORAGE_KEY_REPO_CATALOG = "repoCatalog";
const STORAGE_KEY_LABEL_CACHE = "labelCache";
const STORAGE_KEY_LAST_SUCCESSFUL_TARGET = "lastSuccessfulTarget";

type CaptureSource = "popup" | "command";

type CaptureContext = {
  source: CaptureSource;
  url: string;
  title: string;
  capturedAt: string;
  viewportWidth: number;
  viewportHeight: number;
  clickX: number;
  clickY: number;
};

type RepoCatalogEntry = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
};

type RepoOwnerGroup = {
  owner: string;
  repos: RepoCatalogEntry[];
};

type RepoCatalogCache = {
  owners: RepoOwnerGroup[];
};

type GitHubLabel = {
  id: number;
  name: string;
  color: string;
};

type LabelCache = Record<string, { labels: GitHubLabel[] }>;

type IssueDraftState = {
  title: string;
  description: string;
  editorHtml: string;
  owner: string;
  repo: string;
  labels: GitHubLabel[];
  selectedLabels: string[];
  repoCatalog: RepoCatalogCache | null;
  labelCache: LabelCache;
  error: string | null;
  submitting: boolean;
};

type CreateIssueResponse =
  | {
      ok: true;
      issueNumber: number;
      issueUrl: string;
    }
  | {
      ok: false;
      reason: string;
    };

type SnapWindow = Window & {
  __snapissueContentInstalled?: boolean;
};

const snapWindow = window as SnapWindow;

if (!snapWindow.__snapissueContentInstalled) {
  snapWindow.__snapissueContentInstalled = true;

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isStartCaptureMessage(message)) {
      return false;
    }

    mountCaptureOverlay(message.source);
    return true;
  });
}

function isStartCaptureMessage(
  message: unknown
): message is { type: string; source: CaptureSource } {
  const source =
    typeof message === "object" && message !== null && "source" in message
      ? message.source
      : null;

  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === SNAPISSUE_CONTENT_START_CAPTURE &&
    (source === "popup" || source === "command")
  );
}

function mountCaptureOverlay(source: CaptureSource): void {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement("div");
  const abortController = new AbortController();
  host.id = HOST_ID;
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "auto";

  const shadow = host.attachShadow({ mode: "open" });
  const close = () => {
    abortController.abort();
    host.remove();
  };

  const activateCaptureMode = () => {
    renderCaptureMode(shadow);

    shadow.querySelector("[data-cancel]")?.addEventListener("click", close, {
      signal: abortController.signal
    });

    shadow.querySelector("[data-capture-layer]")?.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("[data-panel]")) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const pointerEvent = event as PointerEvent;
        renderIssueOverlay(
          shadow,
          close,
          activateCaptureMode,
          buildCaptureContext(source, pointerEvent.clientX, pointerEvent.clientY)
        );
      },
      {
        signal: abortController.signal
      }
    );
  };

  activateCaptureMode();

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        close();
      }
    },
    { signal: abortController.signal }
  );

  document.documentElement.append(host);
}

function renderCaptureMode(shadow: ShadowRoot): void {
  shadow.innerHTML = `
    ${baseStyles()}
    <div class="capture-layer" data-capture-layer>
      <section class="capture-hint" data-panel role="dialog" aria-modal="true" aria-label="SnapIssue capture mode">
        <div>
          <h1>SnapIssue</h1>
          <p>Click the point to capture.</p>
        </div>
        <button type="button" data-cancel>Cancel</button>
      </section>
    </div>
  `;
}

function renderIssueOverlay(
  shadow: ShadowRoot,
  close: () => void,
  retake: () => void,
  context: CaptureContext
): void {
  const draft: IssueDraftState = {
    title: "",
    description: "",
    editorHtml: "",
    owner: "",
    repo: "",
    labels: [],
    selectedLabels: [],
    repoCatalog: null,
    labelCache: {},
    error: null,
    submitting: false
  };

  const render = () => {
    shadow.innerHTML = buildIssueFormHtml(context, draft);
    bindIssueForm(shadow, close, retake, context, draft, render);
  };

  render();
  void hydrateDraftTargets(draft).then(render);
}

async function hydrateDraftTargets(draft: IssueDraftState): Promise<void> {
  if (!chrome.storage?.local) {
    return;
  }

  const snapshot = await chrome.storage.local.get([
    STORAGE_KEY_REPO_CATALOG,
    STORAGE_KEY_LABEL_CACHE,
    STORAGE_KEY_LAST_SUCCESSFUL_TARGET
  ]);

  draft.repoCatalog = readRepoCatalog(snapshot[STORAGE_KEY_REPO_CATALOG]);
  draft.labelCache = readLabelCache(snapshot[STORAGE_KEY_LABEL_CACHE]);

  const lastTarget = readLastTarget(snapshot[STORAGE_KEY_LAST_SUCCESSFUL_TARGET]);
  if (
    lastTarget &&
    draft.repoCatalog &&
    findRepo(draft.repoCatalog, lastTarget.owner, lastTarget.repo)
  ) {
    draft.owner = lastTarget.owner;
    draft.repo = lastTarget.repo;
    draft.labels = labelsForRepo(draft.labelCache, draft.owner, draft.repo);
  }
}

function bindIssueForm(
  shadow: ShadowRoot,
  close: () => void,
  retake: () => void,
  context: CaptureContext,
  draft: IssueDraftState,
  render: () => void
): void {
  shadow.querySelector("[data-cancel]")?.addEventListener("click", close);
  shadow.querySelector("[data-retake]")?.addEventListener("click", retake);

  shadow.querySelector("[data-title]")?.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      draft.title = target.value;
    }
  });

  const editor = shadow.querySelector("[data-editor]");
  editor?.addEventListener("input", () => {
    if (editor instanceof HTMLElement) {
      draft.editorHtml = editor.innerHTML;
      draft.description = editorHtmlToMarkdown(editor.innerHTML);
    }
  });

  shadow.querySelectorAll("[data-editor-command]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLButtonElement) || !(editor instanceof HTMLElement)) {
        return;
      }

      applyEditorCommand(editor, target.dataset.editorCommand ?? "");
      draft.editorHtml = editor.innerHTML;
      draft.description = editorHtmlToMarkdown(editor.innerHTML);
    });
  });

  shadow.querySelector("[data-owner]")?.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      draft.owner = target.value;
      draft.repo = "";
      draft.labels = [];
      draft.selectedLabels = [];
      draft.error = null;
      render();
    }
  });

  shadow.querySelector("[data-repo]")?.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      draft.repo = target.value;
      draft.labels = labelsForRepo(draft.labelCache, draft.owner, draft.repo);
      draft.selectedLabels = [];
      draft.error = null;
      render();
    }
  });

  shadow.querySelectorAll("[data-label]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      draft.selectedLabels = target.checked
        ? [...draft.selectedLabels, target.value]
        : draft.selectedLabels.filter((label) => label !== target.value);
    });
  });

  shadow.querySelector("[data-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitIssueDraft(context, draft, render, close);
  });
}

async function submitIssueDraft(
  context: CaptureContext,
  draft: IssueDraftState,
  render: () => void,
  close: () => void
): Promise<void> {
  const validationError = validateDraft(draft);
  if (validationError) {
    draft.error = validationError;
    render();
    return;
  }

  draft.submitting = true;
  draft.error = null;
  render();

  const response = (await chrome.runtime.sendMessage({
    type: SNAPISSUE_CREATE_CONTEXT_ISSUE,
    payload: {
      owner: draft.owner,
      repo: draft.repo,
      title: draft.title,
      description: editorHtmlToMarkdown(draft.editorHtml),
      labels: draft.selectedLabels,
      context: {
        url: context.url,
        title: context.title,
        capturedAt: context.capturedAt,
        viewportWidth: context.viewportWidth,
        viewportHeight: context.viewportHeight,
        clickX: context.clickX,
        clickY: context.clickY
      }
    }
  })) as CreateIssueResponse | undefined;

  if (response?.ok) {
    renderIssueSuccess(response.issueNumber, response.issueUrl, close);
    return;
  }

  draft.submitting = false;
  draft.error = response?.reason ?? "GitHub issue creation failed. Retry when ready.";
  render();
}

function renderIssueSuccess(
  issueNumber: number,
  issueUrl: string,
  close: () => void
): void {
  const host = document.getElementById(HOST_ID);
  const shadow = host?.shadowRoot;
  if (!shadow) {
    return;
  }

  shadow.innerHTML = `
    ${baseStyles()}
    <div class="modal-layer">
      <section class="issue-panel" role="dialog" aria-modal="true" aria-label="SnapIssue issue created">
        <div class="panel-header">
          <div>
            <h1>Issue created</h1>
            <p>#${issueNumber} was created on GitHub.</p>
          </div>
          <button type="button" data-cancel>Close</button>
        </div>
        <div class="button-row">
          <a class="link-button" href="${escapeHtml(issueUrl)}" target="_blank" rel="noreferrer">View Issue</a>
        </div>
      </section>
    </div>
  `;

  shadow.querySelector("[data-cancel]")?.addEventListener("click", close);
}

function buildIssueFormHtml(
  context: CaptureContext,
  draft: IssueDraftState
): string {
  const ownerGroup = draft.repoCatalog?.owners.find(
    (group) => group.owner === draft.owner
  );
  const repoOptions = ownerGroup?.repos ?? [];

  return `
    ${baseStyles()}
    <div class="modal-layer">
      <form class="issue-panel" data-form role="dialog" aria-modal="true" aria-label="SnapIssue issue draft">
        <div class="panel-header">
          <div>
            <h1>Issue draft</h1>
            <p>Context-only GitHub issue.</p>
          </div>
          <button type="button" data-cancel>Cancel</button>
        </div>

        ${draft.error ? `<p class="notice">${escapeHtml(draft.error)}</p>` : ""}

        <div class="form-grid">
          <label>
            <span>Owner</span>
            <select data-owner>
              <option value="">Choose owner</option>
              ${(draft.repoCatalog?.owners ?? [])
                .map(
                  (group) =>
                    `<option value="${escapeHtml(group.owner)}" ${
                      group.owner === draft.owner ? "selected" : ""
                    }>${escapeHtml(group.owner)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>
            <span>Repo</span>
            <select data-repo ${draft.owner ? "" : "disabled"}>
              <option value="">Choose repo</option>
              ${repoOptions
                .map(
                  (repo) =>
                    `<option value="${escapeHtml(repo.name)}" ${
                      repo.name === draft.repo ? "selected" : ""
                    }>${repo.private ? "Private" : "Public"} - ${escapeHtml(
                      repo.name
                    )}</option>`
                )
                .join("")}
            </select>
          </label>
        </div>

        <label>
          <span>Title</span>
          <input data-title type="text" value="${escapeHtml(draft.title)}" />
        </label>

        <div>
          <span class="field-heading">Description</span>
          <div class="editor-shell">
            <div class="editor-toolbar" role="toolbar" aria-label="Description formatting">
              ${editorButton("bold", "B", "Bold")}
              ${editorButton("italic", "I", "Italic")}
              ${editorButton("inline-code", "Code", "Inline code")}
              ${editorButton("code-block", "Block", "Code block")}
              ${editorButton("bullet-list", "Bullets", "Bullet list")}
              ${editorButton("numbered-list", "Numbers", "Numbered list")}
              ${editorButton("task-list", "Tasks", "Task list")}
              ${editorButton("link", "Link", "Link")}
              ${editorButton("quote", "Quote", "Quote")}
              ${editorButton("undo", "Undo", "Undo")}
              ${editorButton("redo", "Redo", "Redo")}
            </div>
            <div
              class="editor-surface"
              contenteditable="true"
              data-editor
              role="textbox"
              aria-label="Description"
              aria-multiline="true"
            >${draft.editorHtml}</div>
          </div>
        </div>

        <div>
          <span class="field-heading">Labels</span>
          <div class="label-list">
            ${
              draft.labels.length > 0
                ? draft.labels.map((label) => buildLabelCheckbox(label, draft)).join("")
                : `<span class="empty-state">${
                    draft.repo ? "No cached labels" : "Choose a repo to select labels"
                  }</span>`
            }
          </div>
        </div>

        ${buildContextDetails(context)}

        <div class="button-row">
          <button type="button" data-retake>Retake</button>
          <button class="primary-action" type="submit" ${
            draft.submitting ? "disabled" : ""
          }>${draft.submitting ? "Creating" : "Create Issue"}</button>
        </div>
      </form>
    </div>
  `;
}

function buildLabelCheckbox(label: GitHubLabel, draft: IssueDraftState): string {
  return `
    <label class="label-chip">
      <input data-label type="checkbox" value="${escapeHtml(label.name)}" ${
        draft.selectedLabels.includes(label.name) ? "checked" : ""
      } />
      <span class="label-swatch" style="background-color:#${escapeHtml(
        label.color
      )}"></span>
      ${escapeHtml(label.name)}
    </label>
  `;
}

function editorButton(command: string, label: string, title: string): string {
  return `<button type="button" data-editor-command="${command}" title="${escapeHtml(
    title
  )}">${escapeHtml(label)}</button>`;
}

function buildContextDetails(context: CaptureContext): string {
  return `
    <dl class="context-grid">
      <div>
        <dt>Page</dt>
        <dd title="${escapeHtml(context.url)}">${escapeHtml(context.url)}</dd>
      </div>
      <div>
        <dt>Title</dt>
        <dd title="${escapeHtml(context.title)}">${escapeHtml(context.title)}</dd>
      </div>
      <div>
        <dt>Captured</dt>
        <dd>${escapeHtml(context.capturedAt)}</dd>
      </div>
      <div>
        <dt>Viewport</dt>
        <dd>${context.viewportWidth} x ${context.viewportHeight}</dd>
      </div>
      <div>
        <dt>Click</dt>
        <dd>x=${context.clickX}, y=${context.clickY}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>${context.source}</dd>
      </div>
    </dl>
  `;
}

function validateDraft(draft: IssueDraftState): string | null {
  if (!draft.title.trim()) {
    return "Title is required.";
  }

  if (!draft.owner || !draft.repo) {
    return "Owner and repo are required.";
  }

  return null;
}

function applyEditorCommand(editor: HTMLElement, command: string): void {
  editor.focus();

  if (command === "bold") {
    document.execCommand("bold");
    return;
  }
  if (command === "italic") {
    document.execCommand("italic");
    return;
  }
  if (command === "bullet-list") {
    document.execCommand("insertUnorderedList");
    return;
  }
  if (command === "numbered-list") {
    document.execCommand("insertOrderedList");
    return;
  }
  if (command === "quote") {
    document.execCommand("formatBlock", false, "blockquote");
    return;
  }
  if (command === "code-block") {
    document.execCommand("formatBlock", false, "pre");
    return;
  }
  if (command === "undo") {
    document.execCommand("undo");
    return;
  }
  if (command === "redo") {
    document.execCommand("redo");
    return;
  }
  if (command === "inline-code") {
    wrapSelection("code");
    return;
  }
  if (command === "task-list") {
    document.execCommand(
      "insertHTML",
      false,
      '<ul data-task-list="true"><li><input type="checkbox" disabled> Task</li></ul>'
    );
    return;
  }
  if (command === "link") {
    const url = window.prompt("Link URL");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  }
}

function wrapSelection(tagName: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return;
  }

  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tagName);
  wrapper.append(range.extractContents());
  range.insertNode(wrapper);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection.addRange(nextRange);
}

function editorHtmlToMarkdown(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return markdownFromNodes(Array.from(template.content.childNodes)).trim();
}

function markdownFromNodes(nodes: Node[]): string {
  return nodes.map(markdownFromNode).join("");
}

function markdownFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const children = () => markdownFromNodes(Array.from(node.childNodes));
  const tagName = node.tagName.toLowerCase();

  if (tagName === "strong" || tagName === "b") {
    return `**${children()}**`;
  }
  if (tagName === "em" || tagName === "i") {
    return `*${children()}*`;
  }
  if (tagName === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") {
    return `\`${children()}\``;
  }
  if (tagName === "pre") {
    return `\n\n\`\`\`\n${node.textContent?.trim() ?? ""}\n\`\`\`\n\n`;
  }
  if (tagName === "a") {
    return `[${children()}](${node.getAttribute("href") ?? ""})`;
  }
  if (tagName === "blockquote") {
    return `\n\n${children()
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}\n\n`;
  }
  if (tagName === "ul") {
    return `\n${Array.from(node.children)
      .map((child) => listItemToMarkdown(child, node.hasAttribute("data-task-list")))
      .join("")}\n`;
  }
  if (tagName === "ol") {
    return `\n${Array.from(node.children)
      .map((child, index) => `${index + 1}. ${markdownFromNode(child).trim()}\n`)
      .join("")}\n`;
  }
  if (tagName === "li") {
    return children();
  }
  if (tagName === "br") {
    return "\n";
  }
  if (tagName === "p" || tagName === "div") {
    return `${children().trim()}\n\n`;
  }

  return children();
}

function listItemToMarkdown(child: Element, taskList: boolean): string {
  const text = markdownFromNode(child).replace(/^\s+/, "").trim();
  if (taskList || child.querySelector("input[type='checkbox']")) {
    const checked = child.querySelector("input[type='checkbox']:checked")
      ? "x"
      : " ";
    return `- [${checked}] ${text.replace(/^Task\s*/, "Task")}\n`;
  }

  return `- ${text}\n`;
}

function buildCaptureContext(
  source: CaptureSource,
  clientX: number,
  clientY: number
): CaptureContext {
  return {
    source,
    url: window.location.href,
    title: document.title || "Untitled page",
    capturedAt: new Date().toISOString(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    clickX: Math.round(clientX),
    clickY: Math.round(clientY)
  };
}

function readRepoCatalog(value: unknown): RepoCatalogCache | null {
  if (!isRecord(value) || !Array.isArray(value.owners)) {
    return null;
  }

  return {
    owners: value.owners
      .filter(isRepoOwnerGroup)
      .map((group) => ({
        owner: group.owner,
        repos: group.repos.filter(isRepoCatalogEntry)
      }))
  };
}

function readLabelCache(value: unknown): LabelCache {
  if (!isRecord(value)) {
    return {};
  }

  const cache: LabelCache = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !Array.isArray(entry.labels)) {
      continue;
    }

    cache[key] = {
      labels: entry.labels.filter(isGitHubLabel)
    };
  }

  return cache;
}

function readLastTarget(value: unknown): { owner: string; repo: string } | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.owner === "string" && typeof value.repo === "string"
    ? { owner: value.owner, repo: value.repo }
    : null;
}

function labelsForRepo(
  labelCache: LabelCache,
  owner: string,
  repo: string
): GitHubLabel[] {
  return labelCache[`${owner}/${repo}`]?.labels ?? [];
}

function findRepo(
  catalog: RepoCatalogCache,
  owner: string,
  repo: string
): RepoCatalogEntry | null {
  return (
    catalog.owners
      .find((group) => group.owner === owner)
      ?.repos.find((entry) => entry.name === repo) ?? null
  );
}

function isRepoOwnerGroup(value: unknown): value is RepoOwnerGroup {
  return isRecord(value) && typeof value.owner === "string" && Array.isArray(value.repos);
}

function isRepoCatalogEntry(value: unknown): value is RepoCatalogEntry {
  return (
    isRecord(value) &&
    typeof value.owner === "string" &&
    typeof value.name === "string" &&
    typeof value.fullName === "string" &&
    typeof value.private === "boolean"
  );
}

function isGitHubLabel(value: unknown): value is GitHubLabel {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.color === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function baseStyles(): string {
  return `
    <style>
      :host {
        all: initial;
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      .capture-layer,
      .modal-layer {
        background: color-mix(in srgb, Canvas 10%, transparent);
        color: CanvasText;
        inset: 0;
        position: fixed;
      }

      .capture-layer {
        cursor: crosshair;
      }

      .modal-layer {
        align-items: start;
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .capture-hint,
      .issue-panel {
        background: Canvas;
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 8px;
        box-shadow: 0 18px 48px color-mix(in srgb, CanvasText 18%, transparent);
        color: CanvasText;
      }

      .capture-hint {
        align-items: center;
        cursor: default;
        display: flex;
        gap: 16px;
        justify-content: space-between;
        inline-size: min(420px, calc(100vw - 32px));
        margin: 24px auto 0;
        padding: 14px;
      }

      .issue-panel {
        display: grid;
        gap: 16px;
        inline-size: min(640px, calc(100vw - 32px));
        padding: 16px;
      }

      .panel-header {
        align-items: start;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      h1,
      p,
      dl,
      dd {
        margin: 0;
      }

      h1 {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.25;
      }

      p {
        color: color-mix(in srgb, CanvasText 66%, transparent);
        font-size: 12px;
        line-height: 1.45;
        margin-block-start: 3px;
      }

      button,
      .link-button {
        align-items: center;
        background: color-mix(in srgb, CanvasText 6%, Canvas);
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 6px;
        color: CanvasText;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 12px;
        font-weight: 750;
        justify-content: center;
        letter-spacing: 0;
        min-block-size: 32px;
        padding: 0 10px;
        text-decoration: none;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      button:focus-visible,
      .link-button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      .primary-action,
      .link-button {
        background: #2563eb;
        border-color: #2563eb;
        color: white;
      }

      label {
        display: grid;
        gap: 6px;
      }

      label span,
      .field-heading {
        color: color-mix(in srgb, CanvasText 62%, transparent);
        font-size: 12px;
        font-weight: 750;
      }

      input,
      select,
      textarea {
        background: Canvas;
        border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
        border-radius: 6px;
        color: CanvasText;
        font: inherit;
        font-size: 13px;
        inline-size: 100%;
      }

      input,
      select {
        block-size: 36px;
        padding: 0 9px;
      }

      textarea {
        min-block-size: 92px;
        padding: 9px;
        resize: vertical;
      }

      .editor-shell {
        border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
        border-radius: 8px;
        display: grid;
        overflow: hidden;
      }

      .editor-toolbar {
        background: color-mix(in srgb, CanvasText 4%, Canvas);
        border-block-end: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 6px;
      }

      .editor-toolbar button {
        min-block-size: 28px;
        padding: 0 8px;
      }

      .editor-surface {
        background: Canvas;
        color: CanvasText;
        font-size: 13px;
        line-height: 1.5;
        min-block-size: 116px;
        outline: none;
        padding: 10px;
        white-space: pre-wrap;
      }

      .editor-surface:empty::before {
        color: color-mix(in srgb, CanvasText 46%, transparent);
        content: "Write the issue description";
      }

      .editor-surface code {
        background: color-mix(in srgb, CanvasText 8%, Canvas);
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        padding: 1px 4px;
      }

      .editor-surface pre {
        background: color-mix(in srgb, CanvasText 8%, Canvas);
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        overflow: auto;
        padding: 8px;
      }

      .form-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .notice {
        background: color-mix(in srgb, #dc2626 10%, Canvas);
        border: 1px solid color-mix(in srgb, #dc2626 24%, transparent);
        border-radius: 6px;
        color: color-mix(in srgb, #b91c1c 76%, CanvasText);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.4;
        padding: 9px 10px;
      }

      .label-list {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-block-start: 8px;
        min-block-size: 34px;
      }

      .label-chip {
        align-items: center;
        background: color-mix(in srgb, CanvasText 5%, Canvas);
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        font-size: 12px;
        font-weight: 700;
        gap: 7px;
        min-block-size: 30px;
        padding: 0 10px;
      }

      .label-chip input {
        block-size: 14px;
        inline-size: 14px;
        margin: 0;
      }

      .label-swatch {
        block-size: 10px;
        border-radius: 999px;
        inline-size: 10px;
      }

      .empty-state {
        color: color-mix(in srgb, CanvasText 58%, transparent);
        font-size: 12px;
        font-weight: 650;
      }

      .context-grid {
        border-block: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
        display: grid;
        gap: 0;
        padding: 6px 0;
      }

      .context-grid div {
        align-items: baseline;
        display: grid;
        gap: 12px;
        grid-template-columns: 92px minmax(0, 1fr);
        min-block-size: 30px;
      }

      dt,
      dd {
        font-size: 12px;
        line-height: 1.4;
      }

      dt {
        color: color-mix(in srgb, CanvasText 56%, transparent);
        font-weight: 750;
      }

      dd {
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .button-row {
        display: flex;
        gap: 8px;
        justify-content: end;
      }

      @media (max-width: 560px) {
        .form-grid {
          grid-template-columns: 1fr;
        }

        .panel-header {
          flex-direction: column;
        }

        .button-row {
          justify-content: start;
        }
      }
    </style>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

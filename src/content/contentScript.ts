const SNAPISSUE_CONTENT_START_CAPTURE = "snapissue:content-start-capture";
const SNAPISSUE_CREATE_CONTEXT_ISSUE = "snapissue:create-context-issue";
const SNAPISSUE_CAPTURE_VISIBLE_TAB = "snapissue:capture-visible-tab";
const HOST_ID = "snapissue-overlay-host";
const TOAST_HOST_ID = "snapissue-toast-host";
const STORAGE_KEY_REPO_CATALOG = "repoCatalog";
const STORAGE_KEY_LABEL_CACHE = "labelCache";
const STORAGE_KEY_LAST_SUCCESSFUL_TARGET = "lastSuccessfulTarget";
const STORAGE_KEY_SENSITIVE_DOMAIN_PATTERNS = "sensitiveDomainPatterns";
const MAX_SCREENSHOTS = 5;
const DEFAULT_SENSITIVE_DOMAIN_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "*.internal",
  "*.admin",
  "mail.google.com",
  "bank",
  "stripe.com"
];

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
  screenshots: DraftScreenshot[];
  includeEnvironmentContext: boolean;
  sensitiveDomainPatterns: string[];
  sensitiveWarningVisible: boolean;
  sensitiveWarningDismissed: boolean;
  sensitiveMatchPattern: string | null;
  captureWarning: string | null;
  cropOpen: boolean;
  activeCropId: string | null;
  crop: CropRect | null;
  repoCatalog: RepoCatalogCache | null;
  labelCache: LabelCache;
  error: string | null;
  submitting: boolean;
};

type CapturedScreenshot = {
  dataUrl: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  clickX: number;
  clickY: number;
};

type DraftScreenshot = CapturedScreenshot & {
  id: string;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CaptureVisibleTabResponse =
  | {
      ok: true;
      dataUrl: string;
    }
  | {
      ok: false;
      reason: string;
    };

type CreateIssueResponse =
  | {
      ok: true;
      issueNumber: number;
      issueUrl: string;
      warning?: string;
      fallbackMarkdown?: string;
    }
  | {
      ok: false;
      reason: string;
    };

type SnapWindow = Window & {
  __snapissueContentInstalled?: boolean;
};

type CaptureModeOptions = {
  onCancel: () => void;
  onComplete: (context: CaptureContext, screenshot: CapturedScreenshot | null) => void;
};

type StartCaptureMode = (options: CaptureModeOptions) => void;

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
  let activeDraft: IssueDraftState | null = null;
  let closed = false;
  host.id = HOST_ID;
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "auto";

  const shadow = host.attachShadow({ mode: "open" });
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    if (activeDraft) {
      clearDraftState(activeDraft);
      activeDraft = null;
    }
    abortController.abort();
    host.remove();
  };
  const eventIsInsideOverlay = (event: Event) =>
    event.composedPath().includes(host);
  const stopPageKeyboardShortcut = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }

    if (eventIsInsideOverlay(event)) {
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const stopShadowKeyboardShortcut = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }

    event.stopImmediatePropagation();
  };
  const stopShadowKeyboardEvent: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      stopShadowKeyboardShortcut(event);
    }
  };

  shadow.addEventListener("keydown", stopShadowKeyboardEvent, {
    capture: true,
    signal: abortController.signal
  });
  shadow.addEventListener("keypress", stopShadowKeyboardEvent, {
    capture: true,
    signal: abortController.signal
  });
  shadow.addEventListener("keyup", stopShadowKeyboardEvent, {
    capture: true,
    signal: abortController.signal
  });

  const startCaptureMode: StartCaptureMode = ({ onCancel, onComplete }) => {
    renderCaptureMode(shadow);

    shadow.querySelector("[data-cancel]")?.addEventListener("click", onCancel, {
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
        const context = buildCaptureContext(
          source,
          pointerEvent.clientX,
          pointerEvent.clientY
        );
        renderCaptureProcessing(shadow);
        void captureMarkedScreenshot(context)
          .then((screenshot) => {
            onComplete(context, screenshot);
          })
          .catch(() => {
            onComplete(context, null);
          });
      },
      {
        signal: abortController.signal
      }
    );
  };

  const startInitialCapture = () => {
    startCaptureMode({
      onCancel: close,
      onComplete: (context, screenshot) => {
        renderIssueOverlay(
          shadow,
          close,
          (draft) => {
            activeDraft = draft;
          },
          startCaptureMode,
          context,
          screenshot
        );
      }
    });
  };

  startInitialCapture();

  document.addEventListener(
    "keydown",
    stopPageKeyboardShortcut,
    { capture: true, signal: abortController.signal }
  );
  document.addEventListener(
    "keypress",
    stopPageKeyboardShortcut,
    { capture: true, signal: abortController.signal }
  );
  document.addEventListener(
    "keyup",
    stopPageKeyboardShortcut,
    { capture: true, signal: abortController.signal }
  );
  window.addEventListener("pagehide", close, { signal: abortController.signal });
  window.addEventListener("beforeunload", close, { signal: abortController.signal });
  window.addEventListener("popstate", close, { signal: abortController.signal });
  window.addEventListener("hashchange", close, { signal: abortController.signal });

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

function renderCaptureProcessing(shadow: ShadowRoot): void {
  shadow.innerHTML = `
    ${baseStyles()}
    <div class="modal-layer">
      <section class="issue-panel" role="dialog" aria-modal="true" aria-label="SnapIssue capture processing">
        <div class="panel-header">
          <div>
            <h1>Capturing screenshot</h1>
            <p>Preparing the marked WebP image.</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderIssueOverlay(
  shadow: ShadowRoot,
  close: () => void,
  setActiveDraft: (draft: IssueDraftState) => void,
  startCaptureMode: StartCaptureMode,
  context: CaptureContext,
  screenshot: CapturedScreenshot | null
): void {
  const initialScreenshot = screenshot ? createDraftScreenshot(screenshot) : null;
  const draft: IssueDraftState = {
    title: "",
    description: "",
    editorHtml: "",
    owner: "",
    repo: "",
    labels: [],
    selectedLabels: [],
    screenshots: initialScreenshot ? [initialScreenshot] : [],
    includeEnvironmentContext: false,
    sensitiveDomainPatterns: [...DEFAULT_SENSITIVE_DOMAIN_PATTERNS],
    sensitiveWarningVisible: false,
    sensitiveWarningDismissed: false,
    sensitiveMatchPattern: null,
    captureWarning: screenshot ? null : "Screenshot capture failed. The issue can still be created.",
    cropOpen: false,
    activeCropId: null,
    crop: null,
    repoCatalog: null,
    labelCache: {},
    error: null,
    submitting: false
  };
  setActiveDraft(draft);

  const render = () => {
    shadow.innerHTML = buildIssueFormHtml(context, draft);
    bindIssueForm(
      shadow,
      close,
      startCaptureMode,
      context,
      draft,
      render
    );
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
    STORAGE_KEY_LAST_SUCCESSFUL_TARGET,
    STORAGE_KEY_SENSITIVE_DOMAIN_PATTERNS
  ]);

  draft.repoCatalog = readRepoCatalog(snapshot[STORAGE_KEY_REPO_CATALOG]);
  draft.labelCache = readLabelCache(snapshot[STORAGE_KEY_LABEL_CACHE]);
  draft.sensitiveDomainPatterns = readSensitiveDomainPatterns(
    snapshot[STORAGE_KEY_SENSITIVE_DOMAIN_PATTERNS]
  );

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
  startCaptureMode: StartCaptureMode,
  context: CaptureContext,
  draft: IssueDraftState,
  render: () => void
): void {
  shadow.querySelector("[data-cancel]")?.addEventListener("click", close);

  shadow.querySelector("[data-add-screenshot]")?.addEventListener("click", () => {
    if (draft.screenshots.length >= MAX_SCREENSHOTS) {
      return;
    }

    startDraftScreenshotCapture(startCaptureMode, draft, render, {
      mode: "add"
    });
  });

  shadow.querySelectorAll("[data-open-crop]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const screenshot = getScreenshotFromEvent(event, draft);
      if (!screenshot) {
        return;
      }

      draft.activeCropId = screenshot.id;
      draft.cropOpen = true;
      draft.crop = {
        x: 0,
        y: 0,
        width: screenshot.width,
        height: screenshot.height
      };
      render();
    });
  });

  shadow.querySelectorAll("[data-retake-screenshot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const screenshot = getScreenshotFromEvent(event, draft);
      if (!screenshot) {
        return;
      }

      startDraftScreenshotCapture(startCaptureMode, draft, render, {
        mode: "replace",
        id: screenshot.id
      });
    });
  });

  shadow.querySelectorAll("[data-remove-screenshot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const screenshot = getScreenshotFromEvent(event, draft);
      if (!screenshot) {
        return;
      }

      draft.screenshots = draft.screenshots.filter((item) => item.id !== screenshot.id);
      if (draft.activeCropId === screenshot.id) {
        draft.activeCropId = null;
        draft.crop = null;
        draft.cropOpen = false;
      }
      draft.captureWarning = null;
      render();
    });
  });

  shadow.querySelectorAll("[data-move-screenshot]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const screenshot = getScreenshotFromEvent(event, draft);
      const direction = target.dataset.moveScreenshot;
      if (!screenshot || (direction !== "left" && direction !== "right")) {
        return;
      }

      moveDraftScreenshot(draft, screenshot.id, direction);
      render();
    });
  });

  shadow.querySelector("[data-close-crop]")?.addEventListener("click", () => {
    draft.cropOpen = false;
    draft.activeCropId = null;
    draft.crop = null;
    render();
  });
  shadow.querySelector("[data-reset-crop]")?.addEventListener("click", () => {
    const screenshot = getActiveCropScreenshot(draft);
    if (!screenshot) {
      return;
    }

    draft.crop = {
      x: 0,
      y: 0,
      width: screenshot.width,
      height: screenshot.height
    };
    render();
  });
  shadow.querySelector("[data-apply-crop]")?.addEventListener("click", () => {
    void applyCrop(draft, render);
  });
  bindCropDrag(shadow, draft);

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

  shadow
    .querySelector("[data-environment-context]")
    ?.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        draft.includeEnvironmentContext = target.checked;
      }
    });

  shadow.querySelector("[data-continue-sensitive]")?.addEventListener("click", () => {
    draft.sensitiveWarningDismissed = true;
    draft.sensitiveWarningVisible = false;
    void submitIssueDraft(context, draft, render, close);
  });

  shadow.querySelector("[data-review-sensitive]")?.addEventListener("click", () => {
    draft.sensitiveWarningVisible = false;
    render();
  });

  shadow.querySelector("[data-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitIssueDraft(context, draft, render, close);
  });
}

type DraftScreenshotCaptureAction =
  | {
      mode: "add";
    }
  | {
      mode: "replace";
      id: string;
    };

function startDraftScreenshotCapture(
  startCaptureMode: StartCaptureMode,
  draft: IssueDraftState,
  render: () => void,
  action: DraftScreenshotCaptureAction
): void {
  draft.cropOpen = false;
  draft.activeCropId = null;
  draft.crop = null;

  startCaptureMode({
    onCancel: render,
    onComplete: (_context, screenshot) => {
      if (!screenshot) {
        draft.captureWarning = "Screenshot capture failed. The issue can still be created.";
        render();
        return;
      }

      if (action.mode === "add") {
        if (draft.screenshots.length < MAX_SCREENSHOTS) {
          draft.screenshots = [...draft.screenshots, createDraftScreenshot(screenshot)];
        }
      } else {
        draft.screenshots = draft.screenshots.map((item) =>
          item.id === action.id ? createDraftScreenshot(screenshot, action.id) : item
        );
      }

      draft.captureWarning = null;
      render();
    }
  });
}

function createDraftScreenshot(
  screenshot: CapturedScreenshot,
  id = createScreenshotId()
): DraftScreenshot {
  return {
    ...screenshot,
    id
  };
}

function createScreenshotId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getScreenshotFromEvent(
  event: Event,
  draft: IssueDraftState
): DraftScreenshot | null {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return findDraftScreenshot(draft, target.dataset.screenshotId ?? "");
}

function findDraftScreenshot(
  draft: IssueDraftState,
  id: string
): DraftScreenshot | null {
  return draft.screenshots.find((screenshot) => screenshot.id === id) ?? null;
}

function getActiveCropScreenshot(draft: IssueDraftState): DraftScreenshot | null {
  return draft.activeCropId ? findDraftScreenshot(draft, draft.activeCropId) : null;
}

function moveDraftScreenshot(
  draft: IssueDraftState,
  id: string,
  direction: "left" | "right"
): void {
  const index = draft.screenshots.findIndex((screenshot) => screenshot.id === id);
  if (index === -1) {
    return;
  }

  const nextIndex = direction === "left" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= draft.screenshots.length) {
    return;
  }

  const reordered = [...draft.screenshots];
  const [item] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, item);
  draft.screenshots = reordered;
}

function toCapturedScreenshot(screenshot: DraftScreenshot): CapturedScreenshot {
  return {
    dataUrl: screenshot.dataUrl,
    mimeType: screenshot.mimeType,
    width: screenshot.width,
    height: screenshot.height,
    clickX: screenshot.clickX,
    clickY: screenshot.clickY
  };
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

  if (window.location.href !== context.url) {
    clearDraftState(draft);
    close();
    return;
  }

  const sensitiveMatch = getSensitiveWarningMatch(context, draft);
  if (sensitiveMatch && !draft.sensitiveWarningDismissed) {
    draft.error = null;
    draft.sensitiveMatchPattern = sensitiveMatch.pattern;
    draft.sensitiveWarningVisible = true;
    render();
    return;
  }

  draft.submitting = true;
  draft.error = null;
  draft.sensitiveWarningVisible = false;
  render();

  const response = (await chrome.runtime.sendMessage({
    type: SNAPISSUE_CREATE_CONTEXT_ISSUE,
    payload: {
      owner: draft.owner,
      repo: draft.repo,
      title: draft.title,
      description: editorHtmlToMarkdown(draft.editorHtml),
      labels: draft.selectedLabels,
      screenshots: draft.screenshots.map(toCapturedScreenshot),
      context: {
        url: context.url,
        title: context.title,
        capturedAt: context.capturedAt,
        viewportWidth: context.viewportWidth,
        viewportHeight: context.viewportHeight,
        clickX: context.clickX,
        clickY: context.clickY,
        environment: draft.includeEnvironmentContext
          ? buildEnvironmentContext()
          : undefined
      }
    }
  })) as CreateIssueResponse | undefined;

  if (response?.ok) {
    close();
    showIssueToast({
      issueNumber: response.issueNumber,
      issueUrl: response.issueUrl,
      warning: response.warning,
      fallbackMarkdown: response.fallbackMarkdown
    });
    return;
  }

  draft.submitting = false;
  draft.error = response?.reason ?? "GitHub issue creation failed. Retry when ready.";
  render();
}

type IssueToastOptions = {
  issueNumber: number;
  issueUrl: string;
  warning?: string;
  fallbackMarkdown?: string;
};

function showIssueToast({
  issueNumber,
  issueUrl,
  warning,
  fallbackMarkdown
}: IssueToastOptions): void {
  document.getElementById(TOAST_HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  host.style.position = "fixed";
  host.style.insetBlockStart = "14px";
  host.style.insetInlineStart = "50%";
  host.style.transform = "translateX(-50%)";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "auto";

  const dismiss = () => {
    window.clearTimeout(timeoutId);
    host.remove();
  };
  const timeoutId = window.setTimeout(dismiss, 5000);
  const shadow = host.attachShadow({ mode: "open" });
  const message = warning ?? "Issue created";

  shadow.innerHTML = `
    ${toastStyles()}
    <section class="toast" role="status" aria-live="polite">
      <div class="toast-copy">
        <h1>${escapeHtml(message)}</h1>
        <p>#${issueNumber} was created on GitHub.</p>
      </div>
      <div class="toast-actions">
        ${
          fallbackMarkdown
            ? `<button type="button" data-copy-links>Copy links</button>`
            : ""
        }
        <button class="primary-action" type="button" data-view-issue>View issue</button>
      </div>
      <span class="toast-progress" aria-hidden="true"></span>
    </section>
  `;

  shadow.querySelector("[data-view-issue]")?.addEventListener("click", () => {
    window.open(issueUrl, "_blank", "noopener,noreferrer");
    dismiss();
  });
  shadow.querySelector("[data-copy-links]")?.addEventListener("click", (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement) || !fallbackMarkdown) {
      return;
    }

    void copyMarkdownToClipboard(fallbackMarkdown)
      .then(() => {
        target.textContent = "Copied";
      })
      .catch(() => {
        target.textContent = "Copy failed";
      });
  });

  document.documentElement.append(host);
}

async function copyMarkdownToClipboard(markdown: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable.");
  }

  await navigator.clipboard.writeText(markdown);
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
        ${draft.sensitiveWarningVisible ? buildSensitiveWarning(draft) : ""}

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

        ${buildScreenshotStrip(draft)}

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
        ${buildEnvironmentOption(draft)}

        <div class="button-row">
          <button class="primary-action" type="submit" ${
            draft.submitting ? "disabled" : ""
          }>${draft.submitting ? "Creating" : "Create Issue"}</button>
        </div>
        ${draft.cropOpen ? buildCropModal(draft) : ""}
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

function buildScreenshotStrip(draft: IssueDraftState): string {
  const addDisabled = draft.screenshots.length >= MAX_SCREENSHOTS;

  return `
    <div>
      <div class="field-heading-row">
        <span class="field-heading">Screenshots</span>
        <span>${draft.screenshots.length} of ${MAX_SCREENSHOTS}</span>
        <button type="button" data-add-screenshot ${
          addDisabled ? "disabled" : ""
        }>Add screenshot</button>
      </div>
      ${draft.captureWarning ? `<p class="notice">${escapeHtml(draft.captureWarning)}</p>` : ""}
      <div class="screenshot-strip" aria-label="Captured screenshots">
        ${
          draft.screenshots.length > 0
            ? draft.screenshots
                .map((screenshot, index) =>
                  buildScreenshotStripItem(screenshot, index, draft.screenshots.length)
                )
                .join("")
            : `<span class="empty-state">No screenshot attached</span>`
        }
      </div>
    </div>
  `;
}

function buildScreenshotStripItem(
  screenshot: DraftScreenshot,
  index: number,
  total: number
): string {
  const id = escapeHtml(screenshot.id);
  const title = `Screenshot ${index + 1}`;

  return `
    <article class="screenshot-item">
      <button
        type="button"
        data-open-crop
        data-screenshot-id="${id}"
        class="preview-button"
        title="Preview and crop ${escapeHtml(title)}"
      >
        <img src="${screenshot.dataUrl}" alt="${escapeHtml(title)} marked preview" />
      </button>
      <div class="screenshot-meta">
        <span>${escapeHtml(title)}: WebP, ${screenshot.width} x ${
          screenshot.height
        }, click x=${screenshot.clickX}, y=${screenshot.clickY}</span>
        <div class="screenshot-actions">
          <button
            type="button"
            data-move-screenshot="left"
            data-screenshot-id="${id}"
            ${index === 0 ? "disabled" : ""}
          >Left</button>
          <button
            type="button"
            data-move-screenshot="right"
            data-screenshot-id="${id}"
            ${index === total - 1 ? "disabled" : ""}
          >Right</button>
          <button
            type="button"
            data-retake-screenshot
            data-screenshot-id="${id}"
          >Retake</button>
          <button
            type="button"
            data-remove-screenshot
            data-screenshot-id="${id}"
          >Remove</button>
        </div>
      </div>
    </article>
  `;
}

function buildCropModal(draft: IssueDraftState): string {
  const screenshot = getActiveCropScreenshot(draft);
  if (!screenshot || !draft.crop) {
    return "";
  }

  const screenshotIndex = draft.screenshots.findIndex((item) => item.id === screenshot.id);
  const cropStyle = cropToPercentStyle(draft.crop, screenshot);

  return `
    <div class="crop-layer" role="dialog" aria-modal="true" aria-label="Screenshot crop">
      <section class="crop-panel">
        <div class="panel-header">
          <div>
            <h1>Screenshot crop</h1>
            <p>Screenshot ${screenshotIndex + 1}. Drag the crop box or its lower-right handle.</p>
          </div>
          <button type="button" data-close-crop>Close</button>
        </div>
        <div class="crop-stage" data-crop-stage>
          <img src="${screenshot.dataUrl}" alt="Screenshot crop source" />
          <div class="crop-box" data-crop-box style="${cropStyle}">
            <span class="crop-handle" data-crop-handle></span>
          </div>
        </div>
        <div class="button-row">
          <button type="button" data-reset-crop>Reset</button>
          <button class="primary-action" type="button" data-apply-crop>Apply Crop</button>
        </div>
      </section>
    </div>
  `;
}

function cropToPercentStyle(
  crop: CropRect,
  screenshot: CapturedScreenshot
): string {
  const left = (crop.x / screenshot.width) * 100;
  const top = (crop.y / screenshot.height) * 100;
  const width = (crop.width / screenshot.width) * 100;
  const height = (crop.height / screenshot.height) * 100;
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%`;
}

function bindCropDrag(shadow: ShadowRoot, draft: IssueDraftState): void {
  const stage = shadow.querySelector("[data-crop-stage]");
  const cropBox = shadow.querySelector("[data-crop-box]");
  const handle = shadow.querySelector("[data-crop-handle]");
  if (!(stage instanceof HTMLElement) || !(cropBox instanceof HTMLElement)) {
    return;
  }

  const startDrag = (event: PointerEvent, mode: "move" | "resize") => {
    const screenshot = getActiveCropScreenshot(draft);
    if (!screenshot || !draft.crop) {
      return;
    }

    event.preventDefault();
    cropBox.setPointerCapture(event.pointerId);
    const start = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      crop: { ...draft.crop }
    };

    const onMove = (moveEvent: PointerEvent) => {
      const activeScreenshot = getActiveCropScreenshot(draft);
      if (!activeScreenshot) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      const dx =
        ((moveEvent.clientX - start.pointerX) / rect.width) * activeScreenshot.width;
      const dy =
        ((moveEvent.clientY - start.pointerY) / rect.height) * activeScreenshot.height;

      draft.crop =
        mode === "move"
          ? clampCrop(
              {
                ...start.crop,
                x: start.crop.x + dx,
                y: start.crop.y + dy
              },
              activeScreenshot
            )
          : clampCrop(
              {
                ...start.crop,
                width: start.crop.width + dx,
                height: start.crop.height + dy
              },
              activeScreenshot
            );

      cropBox.setAttribute(
        "style",
        cropToPercentStyle(draft.crop, activeScreenshot)
      );
    };

    const onUp = () => {
      cropBox.removeEventListener("pointermove", onMove);
      cropBox.removeEventListener("pointerup", onUp);
      cropBox.removeEventListener("pointercancel", onUp);
    };

    cropBox.addEventListener("pointermove", onMove);
    cropBox.addEventListener("pointerup", onUp);
    cropBox.addEventListener("pointercancel", onUp);
  };

  cropBox.addEventListener("pointerdown", (event) => {
    if (event.target === handle) {
      return;
    }
    startDrag(event, "move");
  });
  handle?.addEventListener("pointerdown", (event) => {
    startDrag(event as PointerEvent, "resize");
  });
}

function clampCrop(crop: CropRect, screenshot: CapturedScreenshot): CropRect {
  const minSize = 24;
  const width = Math.min(Math.max(crop.width, minSize), screenshot.width);
  const height = Math.min(Math.max(crop.height, minSize), screenshot.height);
  const x = Math.min(Math.max(crop.x, 0), screenshot.width - width);
  const y = Math.min(Math.max(crop.y, 0), screenshot.height - height);
  return { x, y, width, height };
}

async function applyCrop(
  draft: IssueDraftState,
  render: () => void
): Promise<void> {
  const screenshot = getActiveCropScreenshot(draft);
  if (!screenshot || !draft.crop) {
    return;
  }

  const cropped = await cropScreenshot(screenshot, draft.crop);
  draft.screenshots = draft.screenshots.map((item) =>
    item.id === screenshot.id ? createDraftScreenshot(cropped, screenshot.id) : item
  );
  draft.crop = null;
  draft.activeCropId = null;
  draft.cropOpen = false;
  render();
}

async function cropScreenshot(
  screenshot: CapturedScreenshot,
  crop: CropRect
): Promise<CapturedScreenshot> {
  const image = await loadImage(screenshot.dataUrl);
  const canvas = document.createElement("canvas");
  const safeCrop = clampCrop(crop, screenshot);
  canvas.width = Math.round(safeCrop.width);
  canvas.height = Math.round(safeCrop.height);
  const renderingContext = canvas.getContext("2d");
  if (!renderingContext) {
    throw new Error("Canvas rendering is unavailable.");
  }

  renderingContext.drawImage(
    image,
    safeCrop.x,
    safeCrop.y,
    safeCrop.width,
    safeCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    dataUrl: canvas.toDataURL("image/webp", 0.9),
    mimeType: "image/webp",
    width: canvas.width,
    height: canvas.height,
    clickX: screenshot.clickX - safeCrop.x,
    clickY: screenshot.clickY - safeCrop.y
  };
}

function editorButton(command: string, label: string, title: string): string {
  return `<button type="button" data-editor-command="${command}" title="${escapeHtml(
    title
  )}">${escapeHtml(label)}</button>`;
}

function buildSensitiveWarning(draft: IssueDraftState): string {
  const pattern = draft.sensitiveMatchPattern ?? "configured pattern";
  return `
    <section class="sensitive-warning" role="alert">
      <div>
        <h2>Sensitive domain warning</h2>
        <p>
          This page matches ${escapeHtml(
            pattern
          )}. R2 screenshots are public by link after upload.
        </p>
      </div>
      <div class="button-row">
        <button type="button" data-review-sensitive>Review Draft</button>
        <button class="primary-action" type="button" data-continue-sensitive>
          Continue Upload
        </button>
      </div>
    </section>
  `;
}

function buildEnvironmentOption(draft: IssueDraftState): string {
  return `
    <label class="inline-checkbox">
      <input
        data-environment-context
        type="checkbox"
        ${draft.includeEnvironmentContext ? "checked" : ""}
      />
      <span>Include browser/OS environment</span>
    </label>
  `;
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

function clearDraftState(draft: IssueDraftState): void {
  draft.title = "";
  draft.description = "";
  draft.editorHtml = "";
  draft.owner = "";
  draft.repo = "";
  draft.labels = [];
  draft.selectedLabels = [];
  draft.screenshots = [];
  draft.includeEnvironmentContext = false;
  draft.sensitiveWarningVisible = false;
  draft.sensitiveWarningDismissed = false;
  draft.sensitiveMatchPattern = null;
  draft.captureWarning = null;
  draft.cropOpen = false;
  draft.activeCropId = null;
  draft.crop = null;
  draft.error = null;
  draft.submitting = false;
}

function getSensitiveWarningMatch(
  context: CaptureContext,
  draft: IssueDraftState
): { host: string; pattern: string } | null {
  if (draft.screenshots.length === 0) {
    return null;
  }

  return findSensitiveDomainMatch(context.url, draft.sensitiveDomainPatterns);
}

function findSensitiveDomainMatch(
  url: string,
  patterns: string[]
): { host: string; pattern: string } | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const pattern of normalizeSensitiveDomainPatterns(patterns)) {
    if (sensitivePatternMatches(host, pattern)) {
      return { host, pattern };
    }
  }

  return null;
}

function sensitivePatternMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    return host.endsWith(`.${pattern.slice(2)}`);
  }

  if (!pattern.includes(".")) {
    return host === pattern || host.includes(pattern);
  }

  return host === pattern || host.endsWith(`.${pattern}`);
}

function buildEnvironmentContext(): string {
  const userAgent = navigator.userAgent;
  return `${detectBrowser(userAgent)} on ${detectOperatingSystem(userAgent)}`;
}

function detectBrowser(userAgent: string): string {
  const edge = userAgent.match(/Edg\/([\d.]+)/);
  if (edge) {
    return `Edge ${majorVersion(edge[1])}`;
  }

  const chrome = userAgent.match(/Chrome\/([\d.]+)/);
  if (chrome) {
    return `Chrome ${majorVersion(chrome[1])}`;
  }

  const firefox = userAgent.match(/Firefox\/([\d.]+)/);
  if (firefox) {
    return `Firefox ${majorVersion(firefox[1])}`;
  }

  const safari = userAgent.match(/Version\/([\d.]+).*Safari/);
  if (safari) {
    return `Safari ${majorVersion(safari[1])}`;
  }

  return "Unknown browser";
}

function detectOperatingSystem(userAgent: string): string {
  if (/Windows NT/i.test(userAgent)) {
    return "Windows";
  }
  if (/Mac OS X/i.test(userAgent)) {
    return "macOS";
  }
  if (/Android/i.test(userAgent)) {
    return "Android";
  }
  if (/(iPhone|iPad|iPod)/i.test(userAgent)) {
    return "iOS";
  }
  if (/Linux/i.test(userAgent)) {
    return "Linux";
  }

  return "unknown OS";
}

function majorVersion(version: string): string {
  return version.split(".")[0] || version;
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

async function captureMarkedScreenshot(
  context: CaptureContext
): Promise<CapturedScreenshot> {
  const restoreSnapIssueChrome = hideSnapIssueChromeForCapture();

  try {
    await waitForNextPaint();

    const response = (await chrome.runtime.sendMessage({
      type: SNAPISSUE_CAPTURE_VISIBLE_TAB
    })) as CaptureVisibleTabResponse | undefined;

    if (!response?.ok) {
      throw new Error(response?.reason ?? "Visible tab capture failed.");
    }

    return drawMarkerAndExportWebP(response.dataUrl, context);
  } finally {
    restoreSnapIssueChrome();
  }
}

function hideSnapIssueChromeForCapture(): () => void {
  const elements = [document.getElementById(HOST_ID), document.getElementById(TOAST_HOST_ID)]
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map((element) => ({
      element,
      visibility: element.style.visibility
    }));

  for (const { element } of elements) {
    element.style.visibility = "hidden";
  }

  return () => {
    for (const { element, visibility } of elements) {
      element.style.visibility = visibility;
    }
  };
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function drawMarkerAndExportWebP(
  imageDataUrl: string,
  context: CaptureContext
): Promise<CapturedScreenshot> {
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const renderingContext = canvas.getContext("2d");
  if (!renderingContext) {
    throw new Error("Canvas rendering is unavailable.");
  }

  renderingContext.drawImage(image, 0, 0);

  const scaleX = canvas.width / Math.max(context.viewportWidth, 1);
  const scaleY = canvas.height / Math.max(context.viewportHeight, 1);
  const markerScale = (scaleX + scaleY) / 2;
  const markerX = context.clickX * scaleX;
  const markerY = context.clickY * scaleY;

  renderingContext.beginPath();
  renderingContext.arc(markerX, markerY, 14 * markerScale, 0, Math.PI * 2);
  renderingContext.lineWidth = 5 * markerScale;
  renderingContext.strokeStyle = "rgba(255,255,255,0.95)";
  renderingContext.stroke();

  renderingContext.beginPath();
  renderingContext.arc(markerX, markerY, 14 * markerScale, 0, Math.PI * 2);
  renderingContext.lineWidth = 3 * markerScale;
  renderingContext.strokeStyle = "#ef4444";
  renderingContext.stroke();

  return {
    dataUrl: canvas.toDataURL("image/webp", 0.9),
    mimeType: "image/webp",
    width: canvas.width,
    height: canvas.height,
    clickX: context.clickX,
    clickY: context.clickY
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Screenshot image could not be loaded."));
    image.src = dataUrl;
  });
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

function readSensitiveDomainPatterns(value: unknown): string[] {
  return normalizeSensitiveDomainPatterns(value);
}

function normalizeSensitiveDomainPatterns(value: unknown): string[] {
  const source = Array.isArray(value) ? value : DEFAULT_SENSITIVE_DOMAIN_PATTERNS;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of source) {
    if (typeof item !== "string") {
      continue;
    }

    const pattern = item.trim().toLowerCase();
    if (!pattern || seen.has(pattern)) {
      continue;
    }

    seen.add(pattern);
    normalized.push(pattern);
  }

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_SENSITIVE_DOMAIN_PATTERNS];
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
        --si-accent: #2563eb;
        --si-bg: #f6f7f9;
        --si-border: rgba(15, 23, 42, 0.12);
        --si-border-strong: rgba(15, 23, 42, 0.18);
        --si-danger: #dc2626;
        --si-field: rgba(255, 255, 255, 0.72);
        --si-muted: rgba(15, 23, 42, 0.62);
        --si-panel: rgba(255, 255, 255, 0.72);
        --si-panel-strong: rgba(255, 255, 255, 0.9);
        --si-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
        --si-success: #16a34a;
        --si-text: #0f172a;
        --si-warning: #d97706;
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --si-bg: #0b0c0f;
          --si-border: rgba(255, 255, 255, 0.13);
          --si-border-strong: rgba(255, 255, 255, 0.19);
          --si-field: rgba(255, 255, 255, 0.05);
          --si-muted: rgba(255, 255, 255, 0.64);
          --si-panel: rgba(18, 19, 23, 0.78);
          --si-panel-strong: rgba(255, 255, 255, 0.09);
          --si-shadow: none;
          --si-text: #f7f8fb;
        }
      }

      * {
        box-sizing: border-box;
      }

      .capture-layer,
      .modal-layer {
        background: color-mix(in srgb, var(--si-bg) 18%, transparent);
        color: var(--si-text);
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
        backdrop-filter: blur(18px) saturate(130%);
        background: var(--si-panel);
        border: 1px solid var(--si-border);
        border-radius: 8px;
        box-shadow: var(--si-shadow);
        color: var(--si-text);
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
      h2,
      p,
      dl,
      dd {
        margin: 0;
      }

      h1,
      h2 {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.25;
      }

      p {
        color: var(--si-muted);
        font-size: 12px;
        line-height: 1.45;
        margin-block-start: 3px;
      }

      button,
      .link-button {
        align-items: center;
        background: var(--si-panel-strong);
        border: 1px solid var(--si-border);
        border-radius: 6px;
        box-shadow: var(--si-shadow);
        color: var(--si-text);
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
        outline: 2px solid var(--si-accent);
        outline-offset: 2px;
      }

      .primary-action,
      .link-button {
        background: var(--si-accent);
        border-color: var(--si-accent);
        color: white;
      }

      .primary-action::before {
        content: "+";
        font-weight: 900;
        margin-inline-end: 6px;
      }

      [data-add-screenshot]::before {
        content: "+";
        font-weight: 900;
        margin-inline-end: 6px;
      }

      [data-retake-screenshot]::before {
        content: "";
        block-size: 10px;
        border: 2px solid currentColor;
        border-inline-start-color: transparent;
        border-radius: 999px;
        inline-size: 10px;
        margin-inline-end: 6px;
      }

      [data-remove-screenshot]::before,
      [data-cancel]::before,
      [data-close-crop]::before {
        content: "x";
        font-weight: 900;
        margin-inline-end: 6px;
      }

      label {
        display: grid;
        gap: 6px;
      }

      label span,
      .field-heading {
        color: var(--si-muted);
        font-size: 12px;
        font-weight: 750;
      }

      input,
      select,
      textarea {
        background: var(--si-field);
        border: 1px solid var(--si-border-strong);
        border-radius: 6px;
        color: var(--si-text);
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
        border: 1px solid var(--si-border-strong);
        border-radius: 8px;
        display: grid;
        overflow: hidden;
      }

      .editor-toolbar {
        background: var(--si-panel-strong);
        border-block-end: 1px solid var(--si-border);
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
        background: var(--si-field);
        color: var(--si-text);
        font-size: 13px;
        line-height: 1.5;
        min-block-size: 116px;
        outline: none;
        padding: 10px;
        white-space: pre-wrap;
      }

      .editor-surface:empty::before {
        color: var(--si-muted);
        content: "Write the issue description";
      }

      .editor-surface code {
        background: var(--si-panel-strong);
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        padding: 1px 4px;
      }

      .editor-surface pre {
        background: var(--si-panel-strong);
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
        background: color-mix(in srgb, var(--si-danger) 10%, var(--si-panel));
        border: 1px solid color-mix(in srgb, var(--si-danger) 24%, transparent);
        border-radius: 6px;
        color: color-mix(in srgb, var(--si-danger) 74%, var(--si-text));
        font-size: 12px;
        font-weight: 700;
        line-height: 1.4;
        padding: 9px 10px;
      }

      .sensitive-warning {
        background: color-mix(in srgb, var(--si-warning) 11%, var(--si-panel));
        border: 1px solid color-mix(in srgb, var(--si-warning) 28%, transparent);
        border-radius: 8px;
        display: grid;
        gap: 10px;
        padding: 10px;
      }

      .sensitive-warning p {
        color: color-mix(in srgb, var(--si-warning) 76%, var(--si-text));
        font-weight: 700;
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
        background: var(--si-panel-strong);
        border: 1px solid var(--si-border);
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
        color: var(--si-muted);
        font-size: 12px;
        font-weight: 650;
      }

      .field-heading-row {
        align-items: center;
        display: flex;
        gap: 8px;
        justify-content: space-between;
      }

      .field-heading-row > span:last-of-type {
        color: var(--si-muted);
        font-size: 12px;
        font-weight: 700;
      }

      .screenshot-strip {
        display: grid;
        gap: 8px;
        margin-block-start: 8px;
      }

      .screenshot-item {
        background: var(--si-panel-strong);
        border: 1px solid var(--si-border);
        border-radius: 8px;
        display: grid;
        gap: 8px;
        grid-template-columns: 132px minmax(0, 1fr);
        min-block-size: 96px;
        padding: 8px;
      }

      .preview-button {
        background: var(--si-field);
        border: 0;
        border-radius: 6px;
        display: block;
        inline-size: 100%;
        min-block-size: 80px;
        padding: 0;
      }

      .preview-button img {
        border-radius: 6px;
        block-size: 80px;
        display: block;
        inline-size: 100%;
        object-fit: cover;
      }

      .screenshot-meta {
        align-content: space-between;
        display: grid;
        gap: 10px;
        min-inline-size: 0;
      }

      .screenshot-meta span {
        color: var(--si-muted);
        font-size: 12px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .screenshot-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: end;
      }

      .screenshot-actions button {
        min-block-size: 28px;
        padding: 0 8px;
      }

      .crop-layer {
        align-items: center;
        background: color-mix(in srgb, var(--si-bg) 42%, transparent);
        display: flex;
        inset: 0;
        justify-content: center;
        padding: 24px;
        position: fixed;
        z-index: 1;
      }

      .crop-panel {
        backdrop-filter: blur(18px) saturate(130%);
        background: var(--si-panel);
        border: 1px solid var(--si-border);
        border-radius: 8px;
        box-shadow: var(--si-shadow);
        display: grid;
        gap: 14px;
        inline-size: min(760px, calc(100vw - 32px));
        padding: 16px;
      }

      .crop-stage {
        background: var(--si-field);
        border-radius: 8px;
        display: grid;
        overflow: hidden;
        place-items: center;
        position: relative;
      }

      .crop-stage img {
        display: block;
        inline-size: 100%;
        max-block-size: 520px;
        object-fit: contain;
      }

      .crop-box {
        border: 2px solid var(--si-accent);
        box-shadow: 0 0 0 9999px color-mix(in srgb, var(--si-bg) 58%, transparent);
        cursor: move;
        position: absolute;
      }

      .crop-handle {
        background: var(--si-accent);
        block-size: 14px;
        border: 2px solid var(--si-panel);
        border-radius: 999px;
        cursor: nwse-resize;
        inline-size: 14px;
        inset-block-end: -8px;
        inset-inline-end: -8px;
        position: absolute;
      }

      .context-grid {
        border-block: 1px solid var(--si-border);
        display: grid;
        gap: 0;
        padding: 6px 0;
      }

      .inline-checkbox {
        align-items: center;
        display: inline-flex;
        gap: 8px;
      }

      .inline-checkbox input {
        block-size: 16px;
        inline-size: 16px;
        margin: 0;
      }

      .inline-checkbox span {
        color: var(--si-text);
        font-size: 12px;
        font-weight: 750;
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
        color: var(--si-muted);
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

        .field-heading-row {
          align-items: start;
          flex-direction: column;
        }

        .screenshot-item {
          grid-template-columns: 1fr;
        }

        .screenshot-actions {
          justify-content: start;
        }

        .button-row {
          justify-content: start;
        }
      }
    </style>
  `;
}

function toastStyles(): string {
  return `
    <style>
      :host {
        all: initial;
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        --si-accent: #2563eb;
        --si-bg: #f6f7f9;
        --si-border: rgba(15, 23, 42, 0.12);
        --si-muted: rgba(15, 23, 42, 0.62);
        --si-panel: rgba(255, 255, 255, 0.72);
        --si-panel-strong: rgba(255, 255, 255, 0.9);
        --si-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
        --si-text: #0f172a;
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --si-bg: #0b0c0f;
          --si-border: rgba(255, 255, 255, 0.13);
          --si-muted: rgba(255, 255, 255, 0.64);
          --si-panel: rgba(18, 19, 23, 0.78);
          --si-panel-strong: rgba(255, 255, 255, 0.09);
          --si-shadow: none;
          --si-text: #f7f8fb;
        }
      }

      * {
        box-sizing: border-box;
      }

      .toast {
        animation: toast-in 180ms ease-out;
        backdrop-filter: blur(18px) saturate(130%);
        background: var(--si-panel);
        border: 1px solid var(--si-border);
        border-radius: 8px;
        box-shadow: var(--si-shadow);
        color: var(--si-text);
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(0, 1fr) auto;
        inline-size: min(520px, calc(100vw - 32px));
        overflow: hidden;
        padding: 12px 12px 16px;
        pointer-events: auto;
        position: relative;
      }

      h1,
      p {
        margin: 0;
      }

      h1 {
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.25;
      }

      p {
        color: var(--si-muted);
        font-size: 12px;
        font-weight: 650;
        line-height: 1.4;
        margin-block-start: 3px;
      }

      button {
        align-items: center;
        background: var(--si-panel-strong);
        border: 1px solid var(--si-border);
        border-radius: 6px;
        box-shadow: var(--si-shadow);
        color: var(--si-text);
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 12px;
        font-weight: 750;
        justify-content: center;
        letter-spacing: 0;
        min-block-size: 32px;
        padding: 0 10px;
      }

      button:focus-visible {
        outline: 2px solid var(--si-accent);
        outline-offset: 2px;
      }

      .primary-action {
        background: var(--si-accent);
        border-color: var(--si-accent);
        color: white;
      }

      .toast-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: end;
      }

      .toast-progress {
        animation: toast-progress 5s linear forwards;
        background: var(--si-accent);
        block-size: 3px;
        inset-block-end: 0;
        inset-inline: 0;
        position: absolute;
        transform-origin: left center;
      }

      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes toast-progress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }

      @media (max-width: 520px) {
        .toast {
          grid-template-columns: 1fr;
        }

        .toast-actions {
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

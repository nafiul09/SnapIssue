const SNAPISSUE_CONTENT_START_CAPTURE = "snapissue:content-start-capture";
const HOST_ID = "snapissue-overlay-host";

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
  shadow.innerHTML = `
    ${baseStyles()}
    <div class="modal-layer">
      <section class="issue-panel" role="dialog" aria-modal="true" aria-label="SnapIssue issue draft">
        <div class="panel-header">
          <div>
            <h1>Issue draft</h1>
            <p>Page context captured from the active tab.</p>
          </div>
          <button type="button" data-cancel>Cancel</button>
        </div>

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

        <div class="button-row">
          <button type="button" data-retake>Retake</button>
          <button class="primary-action" type="button" disabled>Create Issue</button>
        </div>
      </section>
    </div>
  `;

  shadow.querySelector("[data-cancel]")?.addEventListener("click", close);
  shadow.querySelector("[data-retake]")?.addEventListener("click", retake);
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

      button {
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
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      .primary-action {
        background: #2563eb;
        border-color: #2563eb;
        color: white;
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

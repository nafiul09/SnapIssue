const SNAPISSUE_CONTENT_START_CAPTURE = "snapissue:content-start-capture";
const HOST_ID = "snapissue-overlay-host";

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

    renderShellOverlay(message.source);
    return true;
  });
}

function isStartCaptureMessage(
  message: unknown
): message is { type: string; source: "popup" | "command" } {
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

function renderShellOverlay(source: "popup" | "command"): void {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
      }

      .backdrop {
        align-items: start;
        background: color-mix(in srgb, Canvas 8%, transparent);
        display: flex;
        inset: 0;
        justify-content: center;
        padding-top: 24px;
        pointer-events: auto;
        position: fixed;
      }

      .panel {
        background: Canvas;
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 8px;
        box-shadow: 0 18px 48px color-mix(in srgb, CanvasText 18%, transparent);
        color: CanvasText;
        display: grid;
        gap: 10px;
        inline-size: min(360px, calc(100vw - 32px));
        padding: 14px;
      }

      .topline {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .brand {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0;
        margin: 0;
      }

      .status {
        color: color-mix(in srgb, CanvasText 70%, transparent);
        font-size: 12px;
        line-height: 1.5;
        margin: 0;
      }

      button {
        align-items: center;
        background: color-mix(in srgb, CanvasText 6%, transparent);
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 6px;
        color: CanvasText;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 12px;
        font-weight: 650;
        justify-content: center;
        min-block-size: 30px;
        padding: 0 10px;
      }

      button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
    </style>
    <div class="backdrop" role="dialog" aria-modal="true" aria-label="SnapIssue capture">
      <section class="panel">
        <div class="topline">
          <h1 class="brand">SnapIssue</h1>
          <button type="button" data-close>Close</button>
        </div>
        <p class="status">Capture command received from ${source}.</p>
      </section>
    </div>
  `;

  shadow.querySelector("[data-close]")?.addEventListener("click", () => {
    host.remove();
  });

  document.documentElement.append(host);
}

import { useEffect, useState } from "react";
import {
  SNAPISSUE_CAPTURE_REQUEST,
  type CaptureRequestMessage,
  type CaptureResult
} from "../shared/runtimeMessages";
import { deriveSetupStatus, type SetupStatus } from "../shared/settingsStatus";
import { SETTINGS_STATUS_STORAGE_KEYS, STORAGE_KEYS } from "../shared/storageKeys";

type CaptureState = "idle" | "starting" | "started" | "failed";

export function PopupApp() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus>(() =>
    deriveSetupStatus({})
  );
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadPopupState().then((popupState) => {
      setSetupStatus(popupState.setupStatus);
      if (popupState.lastCaptureError) {
        setCaptureState("failed");
        setMessage(popupState.lastCaptureError);
      }
    });
  }, []);

  async function handleCaptureIssue() {
    setCaptureState("starting");
    setMessage(null);

    const runtime = globalThis.chrome?.runtime;
    if (!runtime) {
      setCaptureState("failed");
      setMessage("SnapIssue could not reach the extension runtime.");
      return;
    }

    try {
      const response = (await runtime.sendMessage({
        type: SNAPISSUE_CAPTURE_REQUEST,
        source: "popup"
      } satisfies CaptureRequestMessage)) as CaptureResult | undefined;

      if (response?.ok) {
        await globalThis.chrome?.storage?.local?.remove([
          STORAGE_KEYS.lastCaptureError
        ]);
        setCaptureState("started");
        setMessage("Capture started");
        window.close();
        return;
      }

      setCaptureState("failed");
      setMessage(response?.reason ?? "SnapIssue could not start capture.");
    } catch {
      setCaptureState("failed");
      setMessage("SnapIssue could not reach the extension runtime.");
    }
  }

  async function handleOpenSettings() {
    await globalThis.chrome?.runtime?.openOptionsPage();
    window.close();
  }

  return (
    <main className="popup-shell" aria-label="SnapIssue">
      <header className="popup-header">
        <div>
          <p className="eyebrow">SnapIssue</p>
          <h1>Capture</h1>
        </div>
        <span
          className="status-pill"
          data-ready={setupStatus.githubConfigured && setupStatus.r2Configured}
        >
          {setupStatus.summary}
        </span>
      </header>

      <dl className="status-list" aria-label="Setup status">
        <div>
          <dt>GitHub</dt>
          <dd>{setupStatus.githubConfigured ? "Configured" : "Missing"}</dd>
        </div>
        <div>
          <dt>R2</dt>
          <dd>{setupStatus.r2Configured ? "Configured" : "Missing"}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{setupStatus.lastTargetLabel}</dd>
        </div>
      </dl>

      {message ? (
        <p className="runtime-message" data-state={captureState}>
          {message}
        </p>
      ) : null}

      <footer className="actions">
        <button
          className="primary-action"
          type="button"
          disabled={captureState === "starting"}
          onClick={() => void handleCaptureIssue()}
        >
          {captureState === "starting" ? "Starting" : "Capture Issue"}
        </button>
        <button type="button" onClick={() => void handleOpenSettings()}>
          Settings
        </button>
      </footer>
    </main>
  );
}

type PopupState = {
  setupStatus: SetupStatus;
  lastCaptureError: string | null;
};

async function loadPopupState(): Promise<PopupState> {
  if (!globalThis.chrome?.storage?.local) {
    return {
      setupStatus: deriveSetupStatus({}),
      lastCaptureError: null
    };
  }

  const snapshot = await globalThis.chrome.storage.local.get([
    ...SETTINGS_STATUS_STORAGE_KEYS,
    STORAGE_KEYS.lastCaptureError
  ]);
  const lastCaptureError = snapshot[STORAGE_KEYS.lastCaptureError];

  return {
    setupStatus: deriveSetupStatus(snapshot),
    lastCaptureError:
      typeof lastCaptureError === "string" && lastCaptureError.length > 0
        ? lastCaptureError
        : null
  };
}

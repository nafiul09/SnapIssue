import {
  SNAPISSUE_CONTENT_START_CAPTURE,
  type CaptureResult,
  type CaptureSource,
  type ContentStartCaptureMessage
} from "../shared/runtimeMessages";
import { STORAGE_KEYS } from "../shared/storageKeys";

export const CONTENT_SCRIPT_FILE = "assets/contentScript.js";

type ActiveTab = {
  id?: number;
  url?: string;
};

export type CaptureBrowserApi = {
  tabs: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<ActiveTab[]>;
    sendMessage(tabId: number, message: ContentStartCaptureMessage): Promise<unknown>;
  };
  scripting: {
    executeScript(injection: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown>;
  };
  storage?: {
    local: {
      remove(keys: string[]): Promise<void>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  action?: {
    openPopup?: () => Promise<void>;
  };
};

export async function startCaptureFromActiveTab(
  browserApi: CaptureBrowserApi,
  source: CaptureSource
): Promise<CaptureResult> {
  const [activeTab] = await browserApi.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!activeTab?.id) {
    const result = {
      ok: false,
      reason: "SnapIssue needs an active tab before capture can start."
    } as const;
    await publishCaptureFailure(browserApi, result.reason, source);
    return result;
  }

  const blockReason = getCaptureBlockReason(activeTab.url);
  if (blockReason) {
    const result = {
      ok: false,
      reason: blockReason
    } as const;
    await publishCaptureFailure(browserApi, result.reason, source);
    return result;
  }

  await browserApi.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: [CONTENT_SCRIPT_FILE]
  });

  await browserApi.tabs.sendMessage(activeTab.id, {
    type: SNAPISSUE_CONTENT_START_CAPTURE,
    source
  });

  await browserApi.storage?.local.remove([STORAGE_KEYS.lastCaptureError]);
  return { ok: true };
}

export function getCaptureBlockReason(url: string | undefined): string | null {
  if (!url) {
    return "SnapIssue needs an active web page before capture can start.";
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "SnapIssue cannot capture this tab.";
  }

  if (parsed.hostname === "chromewebstore.google.com") {
    return "Chrome Web Store pages do not allow extension capture.";
  }

  if (["http:", "https:", "file:"].includes(parsed.protocol)) {
    return null;
  }

  return "Browser and extension pages do not allow capture.";
}

async function publishCaptureFailure(
  browserApi: CaptureBrowserApi,
  reason: string,
  source: CaptureSource
): Promise<void> {
  await browserApi.storage?.local.set({
    [STORAGE_KEYS.lastCaptureError]: reason
  });

  if (source !== "command") {
    return;
  }

  try {
    await browserApi.action?.openPopup?.();
  } catch {
    // Some Chromium builds do not expose action.openPopup to extensions.
  }
}

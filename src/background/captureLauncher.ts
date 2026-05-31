import {
  SNAPISSUE_CONTENT_START_CAPTURE,
  type CaptureResult,
  type CaptureSource,
  type ContentStartCaptureMessage
} from "../shared/runtimeMessages";

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
    return {
      ok: false,
      reason: "SnapIssue needs an active tab before capture can start."
    };
  }

  const blockReason = getCaptureBlockReason(activeTab.url);
  if (blockReason) {
    return {
      ok: false,
      reason: blockReason
    };
  }

  await browserApi.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: [CONTENT_SCRIPT_FILE]
  });

  await browserApi.tabs.sendMessage(activeTab.id, {
    type: SNAPISSUE_CONTENT_START_CAPTURE,
    source
  });

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

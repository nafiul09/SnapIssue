import { describe, expect, it, vi } from "vitest";
import {
  CONTENT_SCRIPT_FILE,
  getCaptureBlockReason,
  startCaptureFromActiveTab,
  type CaptureBrowserApi
} from "./captureLauncher";
import { SNAPISSUE_CONTENT_START_CAPTURE } from "../shared/runtimeMessages";

describe("getCaptureBlockReason", () => {
  it("allows ordinary web pages", () => {
    expect(getCaptureBlockReason("https://example.com/page")).toBeNull();
    expect(getCaptureBlockReason("http://localhost:5173")).toBeNull();
  });

  it("blocks browser and extension pages", () => {
    expect(getCaptureBlockReason("chrome://extensions")).toMatch(
      /do not allow capture/
    );
    expect(getCaptureBlockReason("chrome-extension://abc/options.html")).toMatch(
      /do not allow capture/
    );
  });

  it("blocks Chrome Web Store pages explicitly", () => {
    expect(
      getCaptureBlockReason("https://chromewebstore.google.com/detail/example")
    ).toBe("Chrome Web Store pages do not allow extension capture.");
  });
});

describe("startCaptureFromActiveTab", () => {
  it("injects the content script and sends the start-capture message", async () => {
    const api = createBrowserApi("https://example.com/current");

    await expect(startCaptureFromActiveTab(api, "command")).resolves.toEqual({
      ok: true
    });

    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: [CONTENT_SCRIPT_FILE]
    });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: SNAPISSUE_CONTENT_START_CAPTURE,
      source: "command"
    });
  });

  it("returns a graceful result without injecting on protected pages", async () => {
    const api = createBrowserApi("chrome://extensions");

    await expect(startCaptureFromActiveTab(api, "popup")).resolves.toEqual({
      ok: false,
      reason: "Browser and extension pages do not allow capture."
    });

    expect(api.scripting.executeScript).not.toHaveBeenCalled();
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });
});

function createBrowserApi(url: string): CaptureBrowserApi {
  return {
    tabs: {
      query: vi.fn(async () => [{ id: 42, url }]),
      sendMessage: vi.fn(async () => undefined)
    },
    scripting: {
      executeScript: vi.fn(async () => undefined)
    }
  };
}

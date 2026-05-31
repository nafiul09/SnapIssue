import { startCaptureFromActiveTab } from "./captureLauncher";
import { createContextOnlyIssue } from "./contextIssueCreator";
import { testR2Connection } from "./r2Uploader";
import { normalizeR2Settings } from "../shared/r2Settings";
import {
  SNAPISSUE_CAPTURE_COMMAND,
  type CaptureRequestMessage,
  isCaptureRequestMessage,
  isCaptureVisibleTabMessage,
  isCreateContextIssueMessage,
  isTestR2ConnectionMessage
} from "../shared/runtimeMessages";

chrome.commands.onCommand.addListener((command) => {
  if (command !== SNAPISSUE_CAPTURE_COMMAND) {
    return;
  }

  void startCaptureFromActiveTab(chrome, "command");
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (isCreateContextIssueMessage(message)) {
      void createContextOnlyIssue(chrome.storage.local, message.payload)
        .then(sendResponse)
        .catch(() => {
          sendResponse({
            ok: false,
            reason: "GitHub issue creation failed. Check token access and retry."
          });
        });

      return true;
    }

    if (isCaptureVisibleTabMessage(message)) {
      void chrome.tabs
        .captureVisibleTab({
          format: "png"
        })
        .then((dataUrl) => {
          sendResponse({
            ok: true,
            dataUrl
          });
        })
        .catch(() => {
          sendResponse({
            ok: false,
            reason: "Visible tab capture failed."
          });
        });

      return true;
    }

    if (isTestR2ConnectionMessage(message)) {
      void testR2Connection({
        settings: normalizeR2Settings(message.payload)
      })
        .then((result) => {
          sendResponse({
            ok: true,
            publicUrl: result.publicUrl,
            deleted: result.deleted
          });
        })
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            reason:
              error instanceof Error
                ? error.message
                : "R2 connection test failed."
          });
        });

      return true;
    }

    if (!isCaptureRequestMessage(message)) {
      return false;
    }

    void handleCaptureRequest(message)
      .then(sendResponse)
      .catch(() => {
        sendResponse({
          ok: false,
          reason: "SnapIssue could not start capture."
        });
      });

    return true;
  }
);

async function handleCaptureRequest(message: CaptureRequestMessage) {
  return startCaptureFromActiveTab(chrome, message.source);
}

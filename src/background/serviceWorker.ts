import { startCaptureFromActiveTab } from "./captureLauncher";
import { createContextOnlyIssue } from "./contextIssueCreator";
import {
  SNAPISSUE_CAPTURE_COMMAND,
  type CaptureRequestMessage,
  isCaptureRequestMessage,
  isCaptureVisibleTabMessage,
  isCreateContextIssueMessage
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

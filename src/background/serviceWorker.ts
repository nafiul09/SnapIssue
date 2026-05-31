import { startCaptureFromActiveTab } from "./captureLauncher";
import {
  SNAPISSUE_CAPTURE_COMMAND,
  type CaptureRequestMessage,
  isCaptureRequestMessage
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

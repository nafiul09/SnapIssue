export const SNAPISSUE_CAPTURE_COMMAND = "capture_issue";
export const SNAPISSUE_CAPTURE_REQUEST = "snapissue:capture-request";
export const SNAPISSUE_CONTENT_START_CAPTURE = "snapissue:content-start-capture";

export type CaptureSource = "popup" | "command";

export type CaptureRequestMessage = {
  type: typeof SNAPISSUE_CAPTURE_REQUEST;
  source: CaptureSource;
};

export type ContentStartCaptureMessage = {
  type: typeof SNAPISSUE_CONTENT_START_CAPTURE;
  source: CaptureSource;
};

export type CaptureResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    };

export function isCaptureRequestMessage(
  message: unknown
): message is CaptureRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === SNAPISSUE_CAPTURE_REQUEST
  );
}

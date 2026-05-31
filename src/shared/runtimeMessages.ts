export const SNAPISSUE_CAPTURE_COMMAND = "capture_issue";
export const SNAPISSUE_CAPTURE_REQUEST = "snapissue:capture-request";
export const SNAPISSUE_CONTENT_START_CAPTURE = "snapissue:content-start-capture";
export const SNAPISSUE_CREATE_CONTEXT_ISSUE =
  "snapissue:create-context-issue";
export const SNAPISSUE_CAPTURE_VISIBLE_TAB = "snapissue:capture-visible-tab";

export type CaptureSource = "popup" | "command";

export type CaptureRequestMessage = {
  type: typeof SNAPISSUE_CAPTURE_REQUEST;
  source: CaptureSource;
};

export type ContentStartCaptureMessage = {
  type: typeof SNAPISSUE_CONTENT_START_CAPTURE;
  source: CaptureSource;
};

export type CapturedPageContext = {
  url: string;
  title: string;
  capturedAt: string;
  viewportWidth: number;
  viewportHeight: number;
  clickX: number;
  clickY: number;
};

export type CreateContextIssuePayload = {
  owner: string;
  repo: string;
  title: string;
  description: string;
  labels: string[];
  context: CapturedPageContext;
  screenshot?: CapturedScreenshot;
  screenshots?: CapturedScreenshot[];
};

export type CapturedScreenshot = {
  dataUrl: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  clickX: number;
  clickY: number;
};

export type CreateContextIssueMessage = {
  type: typeof SNAPISSUE_CREATE_CONTEXT_ISSUE;
  payload: CreateContextIssuePayload;
};

export type CaptureVisibleTabMessage = {
  type: typeof SNAPISSUE_CAPTURE_VISIBLE_TAB;
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

export function isCaptureVisibleTabMessage(
  message: unknown
): message is CaptureVisibleTabMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === SNAPISSUE_CAPTURE_VISIBLE_TAB
  );
}

export function isCreateContextIssueMessage(
  message: unknown
): message is CreateContextIssueMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === SNAPISSUE_CREATE_CONTEXT_ISSUE &&
    "payload" in message &&
    typeof message.payload === "object" &&
    message.payload !== null
  );
}

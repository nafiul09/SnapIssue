export type R2Settings = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

const R2_SETTING_KEYS = [
  "accountId",
  "bucketName",
  "accessKeyId",
  "secretAccessKey",
  "publicBaseUrl"
] as const;

export class R2SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2SettingsError";
  }
}

export function normalizeR2Settings(settings: R2Settings): R2Settings {
  const normalized: R2Settings = {
    accountId: settings.accountId.trim(),
    bucketName: settings.bucketName.trim(),
    accessKeyId: settings.accessKeyId.trim(),
    secretAccessKey: settings.secretAccessKey.trim(),
    publicBaseUrl: trimTrailingSlash(settings.publicBaseUrl.trim())
  };

  for (const key of R2_SETTING_KEYS) {
    if (!normalized[key]) {
      throw new R2SettingsError(`${labelForKey(key)} is required.`);
    }
  }

  assertHttpUrl(normalized.publicBaseUrl);
  return normalized;
}

export function parseR2SettingsImport(json: string): R2Settings {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new R2SettingsError("R2 import JSON is invalid.");
  }

  if (!isRecord(payload)) {
    throw new R2SettingsError("R2 import must be a JSON object.");
  }

  const candidate = {
    accountId: readString(payload, "accountId"),
    bucketName: readString(payload, "bucketName"),
    accessKeyId: readString(payload, "accessKeyId"),
    secretAccessKey: readString(payload, "secretAccessKey"),
    publicBaseUrl: readString(payload, "publicBaseUrl")
  };

  return normalizeR2Settings(candidate);
}

export function buildR2SettingsExport(settings: R2Settings): string {
  const normalized = normalizeR2Settings(settings);
  const r2OnlyPayload: R2Settings = {
    accountId: normalized.accountId,
    bucketName: normalized.bucketName,
    accessKeyId: normalized.accessKeyId,
    secretAccessKey: normalized.secretAccessKey,
    publicBaseUrl: normalized.publicBaseUrl
  };

  return `${JSON.stringify(r2OnlyPayload, null, 2)}\n`;
}

export function emptyR2Settings(): R2Settings {
  return {
    accountId: "",
    bucketName: "",
    accessKeyId: "",
    secretAccessKey: "",
    publicBaseUrl: ""
  };
}

function readString(payload: Record<string, unknown>, key: keyof R2Settings): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function assertHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new R2SettingsError("Public base URL must be a valid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new R2SettingsError("Public base URL must use HTTP or HTTPS.");
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function labelForKey(key: keyof R2Settings): string {
  return {
    accountId: "R2 account ID",
    bucketName: "R2 bucket name",
    accessKeyId: "R2 access key ID",
    secretAccessKey: "R2 secret access key",
    publicBaseUrl: "R2 public base URL"
  }[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

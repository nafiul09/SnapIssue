export const STORAGE_KEYS = {
  githubToken: "githubToken",
  githubLogin: "githubLogin",
  r2Settings: "r2Settings",
  repoCatalog: "repoCatalog",
  labelCache: "labelCache",
  lastCaptureError: "lastCaptureError",
  lastSuccessfulTarget: "lastSuccessfulTarget",
  sensitiveDomainPatterns: "sensitiveDomainPatterns"
} as const;

export const SETTINGS_STATUS_STORAGE_KEYS = [
  STORAGE_KEYS.githubToken,
  STORAGE_KEYS.githubLogin,
  STORAGE_KEYS.r2Settings,
  STORAGE_KEYS.lastSuccessfulTarget
] as const;

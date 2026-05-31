import { normalizeR2Settings, type R2Settings } from "./r2Settings";
import { STORAGE_KEYS } from "./storageKeys";

export type LocalSettingsStorage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

export type StoredSettings = {
  githubToken: string;
  githubLogin: string;
  r2Settings: R2Settings | null;
};

export async function loadStoredSettings(
  storage: LocalSettingsStorage
): Promise<StoredSettings> {
  const snapshot = await storage.get([
    STORAGE_KEYS.githubToken,
    STORAGE_KEYS.githubLogin,
    STORAGE_KEYS.r2Settings
  ]);

  return {
    githubToken: readString(snapshot[STORAGE_KEYS.githubToken]),
    githubLogin: readString(snapshot[STORAGE_KEYS.githubLogin]),
    r2Settings: readR2Settings(snapshot[STORAGE_KEYS.r2Settings])
  };
}

export async function saveGitHubCredentials(
  storage: LocalSettingsStorage,
  token: string,
  login: string
): Promise<void> {
  await storage.set({
    [STORAGE_KEYS.githubToken]: token.trim(),
    [STORAGE_KEYS.githubLogin]: login
  });
}

export async function clearGitHubCredentials(
  storage: LocalSettingsStorage
): Promise<void> {
  await storage.remove([STORAGE_KEYS.githubToken, STORAGE_KEYS.githubLogin]);
}

export async function saveR2Settings(
  storage: LocalSettingsStorage,
  settings: R2Settings
): Promise<R2Settings> {
  const normalized = normalizeR2Settings(settings);
  await storage.set({
    [STORAGE_KEYS.r2Settings]: normalized
  });
  return normalized;
}

export async function clearR2Settings(storage: LocalSettingsStorage): Promise<void> {
  await storage.remove([STORAGE_KEYS.r2Settings]);
}

function readR2Settings(value: unknown): R2Settings | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  try {
    return normalizeR2Settings(value as R2Settings);
  } catch {
    return null;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

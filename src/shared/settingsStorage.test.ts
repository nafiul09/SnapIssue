import { describe, expect, it, vi } from "vitest";
import {
  clearGitHubCredentials,
  clearR2Settings,
  loadStoredSettings,
  saveGitHubCredentials,
  saveSensitiveDomainPatterns,
  saveR2Settings,
  type LocalSettingsStorage
} from "./settingsStorage";
import { DEFAULT_SENSITIVE_DOMAIN_PATTERNS } from "./sensitiveDomains";
import { STORAGE_KEYS } from "./storageKeys";

describe("settingsStorage", () => {
  it("saves and clears GitHub credentials through local storage keys", async () => {
    const storage = createFakeStorage();

    await saveGitHubCredentials(storage, " token-value ", "octocat");
    expect(storage.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.githubToken]: "token-value",
      [STORAGE_KEYS.githubLogin]: "octocat"
    });

    await clearGitHubCredentials(storage);
    expect(storage.remove).toHaveBeenCalledWith([
      STORAGE_KEYS.githubToken,
      STORAGE_KEYS.githubLogin
    ]);
  });

  it("saves and clears normalized R2 settings through local storage keys", async () => {
    const storage = createFakeStorage();

    await expect(
      saveR2Settings(storage, {
        accountId: " account ",
        bucketName: "bucket",
        accessKeyId: "access",
        secretAccessKey: "secret",
        publicBaseUrl: "https://assets.example.com/"
      })
    ).resolves.toEqual({
      accountId: "account",
      bucketName: "bucket",
      accessKeyId: "access",
      secretAccessKey: "secret",
      publicBaseUrl: "https://assets.example.com"
    });

    expect(storage.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.r2Settings]: {
        accountId: "account",
        bucketName: "bucket",
        accessKeyId: "access",
        secretAccessKey: "secret",
        publicBaseUrl: "https://assets.example.com"
      }
    });

    await clearR2Settings(storage);
    expect(storage.remove).toHaveBeenCalledWith([STORAGE_KEYS.r2Settings]);
  });

  it("loads stored settings and drops invalid R2 settings", async () => {
    const storage = createFakeStorage({
      [STORAGE_KEYS.githubToken]: "token-value",
      [STORAGE_KEYS.githubLogin]: "octocat",
      [STORAGE_KEYS.r2Settings]: { bucketName: "missing-fields" }
    });

    await expect(loadStoredSettings(storage)).resolves.toEqual({
      githubToken: "token-value",
      githubLogin: "octocat",
      r2Settings: null,
      sensitiveDomainPatterns: [...DEFAULT_SENSITIVE_DOMAIN_PATTERNS]
    });
  });

  it("saves normalized sensitive domain patterns", async () => {
    const storage = createFakeStorage();

    await expect(
      saveSensitiveDomainPatterns(storage, [" Stripe.com ", "stripe.com", "*.Admin"])
    ).resolves.toEqual(["stripe.com", "*.admin"]);

    expect(storage.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.sensitiveDomainPatterns]: ["stripe.com", "*.admin"]
    });
  });
});

function createFakeStorage(
  initialValues: Record<string, unknown> = {}
): LocalSettingsStorage {
  return {
    get: vi.fn(async (keys: string[]) =>
      Object.fromEntries(keys.map((key) => [key, initialValues[key]]))
    ),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined)
  };
}

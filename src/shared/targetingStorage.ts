import type { GitHubLabel } from "./githubClient";
import type { RepoCatalogCache } from "./repoCatalog";
import type { LocalSettingsStorage } from "./settingsStorage";
import { STORAGE_KEYS } from "./storageKeys";

export type LabelCache = Record<
  string,
  {
    fetchedAt: string;
    labels: GitHubLabel[];
  }
>;

export async function loadRepoCatalog(
  storage: LocalSettingsStorage
): Promise<RepoCatalogCache | null> {
  const snapshot = await storage.get([STORAGE_KEYS.repoCatalog]);
  const catalog = snapshot[STORAGE_KEYS.repoCatalog];

  if (!isRepoCatalogCache(catalog)) {
    return null;
  }

  return catalog;
}

export async function saveRepoCatalog(
  storage: LocalSettingsStorage,
  catalog: RepoCatalogCache
): Promise<void> {
  await storage.set({
    [STORAGE_KEYS.repoCatalog]: catalog
  });
}

export async function loadLabelsForRepo(
  storage: LocalSettingsStorage,
  owner: string,
  repo: string
): Promise<GitHubLabel[]> {
  const snapshot = await storage.get([STORAGE_KEYS.labelCache]);
  const cache = readLabelCache(snapshot[STORAGE_KEYS.labelCache]);
  return cache[labelCacheKey(owner, repo)]?.labels ?? [];
}

export async function saveLabelsForRepo(
  storage: LocalSettingsStorage,
  owner: string,
  repo: string,
  labels: GitHubLabel[],
  fetchedAt = new Date().toISOString()
): Promise<void> {
  const snapshot = await storage.get([STORAGE_KEYS.labelCache]);
  const cache = readLabelCache(snapshot[STORAGE_KEYS.labelCache]);

  await storage.set({
    [STORAGE_KEYS.labelCache]: {
      ...cache,
      [labelCacheKey(owner, repo)]: {
        fetchedAt,
        labels
      }
    }
  });
}

export function sortLabels(labels: GitHubLabel[]): GitHubLabel[] {
  return [...labels].sort((left, right) => left.name.localeCompare(right.name));
}

function labelCacheKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function readLabelCache(value: unknown): LabelCache {
  if (!isRecord(value)) {
    return {};
  }

  const cache: LabelCache = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !Array.isArray(entry.labels)) {
      continue;
    }

    cache[key] = {
      fetchedAt: typeof entry.fetchedAt === "string" ? entry.fetchedAt : "",
      labels: entry.labels.filter(isGitHubLabel)
    };
  }

  return cache;
}

function isRepoCatalogCache(value: unknown): value is RepoCatalogCache {
  return (
    isRecord(value) &&
    typeof value.fetchedAt === "string" &&
    Array.isArray(value.owners)
  );
}

function isGitHubLabel(value: unknown): value is GitHubLabel {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.color === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

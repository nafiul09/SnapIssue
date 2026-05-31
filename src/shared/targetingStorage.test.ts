import { describe, expect, it, vi } from "vitest";
import {
  loadLabelsForRepo,
  loadRepoCatalog,
  saveLabelsForRepo,
  saveRepoCatalog
} from "./targetingStorage";
import type { LocalSettingsStorage } from "./settingsStorage";
import { STORAGE_KEYS } from "./storageKeys";

describe("targetingStorage", () => {
  it("saves and loads cached repo catalogs", async () => {
    const storage = createFakeStorage();
    const catalog = {
      fetchedAt: "2026-05-31T00:00:00.000Z",
      owners: [{ owner: "acme", repos: [] }]
    };

    await saveRepoCatalog(storage, catalog);
    expect(storage.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.repoCatalog]: catalog
    });

    const loadingStorage = createFakeStorage({
      [STORAGE_KEYS.repoCatalog]: catalog
    });
    await expect(loadRepoCatalog(loadingStorage)).resolves.toEqual(catalog);
  });

  it("saves and loads label cache entries by owner and repo", async () => {
    const storage = createFakeStorage();

    await saveLabelsForRepo(
      storage,
      "acme",
      "web",
      [{ id: 1, name: "bug", color: "d73a4a", description: null }],
      "2026-05-31T00:00:00.000Z"
    );

    expect(storage.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.labelCache]: {
        "acme/web": {
          fetchedAt: "2026-05-31T00:00:00.000Z",
          labels: [{ id: 1, name: "bug", color: "d73a4a", description: null }]
        }
      }
    });

    const loadingStorage = createFakeStorage({
      [STORAGE_KEYS.labelCache]: {
        "acme/web": {
          fetchedAt: "2026-05-31T00:00:00.000Z",
          labels: [{ id: 1, name: "bug", color: "d73a4a", description: null }]
        }
      }
    });

    await expect(loadLabelsForRepo(loadingStorage, "acme", "web")).resolves.toEqual([
      { id: 1, name: "bug", color: "d73a4a", description: null }
    ]);
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

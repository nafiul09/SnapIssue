import { describe, expect, it, vi } from "vitest";
import {
  createContextOnlyIssue,
  type ContextIssueStorage
} from "./contextIssueCreator";
import type { CreateContextIssuePayload } from "../shared/runtimeMessages";
import { STORAGE_KEYS } from "../shared/storageKeys";

const payload: CreateContextIssuePayload = {
  owner: "acme",
  repo: "web",
  title: "Broken button",
  description: "The primary button is clipped.",
  labels: ["bug"],
  context: {
    url: "https://example.com/page",
    title: "Example Page",
    capturedAt: "2026-05-31T12:00:00.000Z",
    viewportWidth: 1440,
    viewportHeight: 900,
    clickX: 321,
    clickY: 222
  }
};

describe("createContextOnlyIssue", () => {
  it("creates the issue and remembers the target only after success", async () => {
    const storage = createStorage({ [STORAGE_KEYS.githubToken]: "token-value" });
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          number: 123,
          html_url: "https://github.com/acme/web/issues/123"
        }),
        { status: 201 }
      )
    );

    await expect(createContextOnlyIssue(storage, payload, fetchImpl)).resolves.toEqual({
      ok: true,
      issueNumber: 123,
      issueUrl: "https://github.com/acme/web/issues/123"
    });
    expect(storage.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.lastSuccessfulTarget]: {
        owner: "acme",
        repo: "web"
      }
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/web/issues",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"labels":["bug"]')
      })
    );
  });

  it("does not remember the target when GitHub issue creation fails", async () => {
    const storage = createStorage({ [STORAGE_KEYS.githubToken]: "token-value" });
    const fetchImpl = vi.fn(async () => new Response("denied", { status: 403 }));

    await expect(createContextOnlyIssue(storage, payload, fetchImpl)).resolves.toEqual({
      ok: false,
      reason: "GitHub issue creation failed. Check token access and retry."
    });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("requires title and target before submit", async () => {
    const storage = createStorage({ [STORAGE_KEYS.githubToken]: "token-value" });

    await expect(
      createContextOnlyIssue(storage, { ...payload, title: " " })
    ).resolves.toEqual({
      ok: false,
      reason: "Issue title is required."
    });
    await expect(
      createContextOnlyIssue(storage, { ...payload, repo: "" })
    ).resolves.toEqual({
      ok: false,
      reason: "Owner and repo are required."
    });
  });
});

function createStorage(
  values: Record<string, unknown>
): ContextIssueStorage & { set: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async (keys: string[]) =>
      Object.fromEntries(keys.map((key) => [key, values[key]]))
    ),
    set: vi.fn(async () => undefined)
  };
}

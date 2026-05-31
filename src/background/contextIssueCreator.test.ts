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

  it("creates the issue before uploading and patching screenshot Markdown", async () => {
    const storage = createStorage({
      [STORAGE_KEYS.githubToken]: "token-value",
      [STORAGE_KEYS.githubLogin]: "octocat",
      [STORAGE_KEYS.r2Settings]: {
        accountId: "account",
        bucketName: "bucket",
        accessKeyId: "access",
        secretAccessKey: "secret",
        publicBaseUrl: "https://assets.example.com"
      }
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            number: 123,
            html_url: "https://github.com/acme/web/issues/123"
          }),
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            number: 123,
            html_url: "https://github.com/acme/web/issues/123"
          }),
          { status: 200 }
        )
      );
    const uploadScreenshot = vi.fn(async () => ({
      key: "captures/file.webp",
      publicUrl: "https://assets.example.com/captures/file.webp"
    }));

    await createContextOnlyIssue(
      storage,
      {
        ...payload,
        screenshot: {
          dataUrl: "data:image/webp;base64,abc",
          mimeType: "image/webp",
          width: 1440,
          height: 900,
          clickX: 321,
          clickY: 222
        }
      },
      fetchImpl,
      uploadScreenshot
    );

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/acme/web/issues"
    );
    expect(uploadScreenshot.mock.invocationCallOrder[0]).toBeGreaterThan(
      fetchImpl.mock.invocationCallOrder[0]
    );
    expect(fetchImpl.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/acme/web/issues/123"
    );
    expect(fetchImpl.mock.calls[1][1].body).toContain("## Screenshots");
    expect(fetchImpl.mock.calls[1][1].body).toContain(
      "https://assets.example.com/captures/file.webp"
    );
  });

  it("keeps the issue created when screenshot upload fails", async () => {
    const storage = createStorage({
      [STORAGE_KEYS.githubToken]: "token-value",
      [STORAGE_KEYS.githubLogin]: "octocat",
      [STORAGE_KEYS.r2Settings]: {
        accountId: "account",
        bucketName: "bucket",
        accessKeyId: "access",
        secretAccessKey: "secret",
        publicBaseUrl: "https://assets.example.com"
      }
    });
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          number: 123,
          html_url: "https://github.com/acme/web/issues/123"
        }),
        { status: 201 }
      )
    );
    const uploadScreenshot = vi.fn(async () => {
      throw new Error("upload failed");
    });

    await expect(
      createContextOnlyIssue(
        storage,
        {
          ...payload,
          screenshot: {
            dataUrl: "data:image/webp;base64,abc",
            mimeType: "image/webp",
            width: 1440,
            height: 900,
            clickX: 321,
            clickY: 222
          }
        },
        fetchImpl,
        uploadScreenshot
      )
    ).resolves.toEqual({
      ok: true,
      issueNumber: 123,
      issueUrl: "https://github.com/acme/web/issues/123",
      warning: "Issue created, screenshot failed."
    });
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

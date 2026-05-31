import { describe, expect, it, vi } from "vitest";
import {
  buildR2TestObjectKey,
  buildR2ObjectKey,
  dataUrlToUint8Array,
  testR2Connection,
  uploadWebPScreenshotToR2
} from "./r2Uploader";

const settings = {
  accountId: "account",
  bucketName: "bucket",
  accessKeyId: "access",
  secretAccessKey: "secret",
  publicBaseUrl: "https://assets.example.com"
};

describe("r2Uploader", () => {
  it("builds date/user/repo scoped WebP object keys", () => {
    expect(
      buildR2ObjectKey({
        now: new Date("2026-05-31T12:00:00.000Z"),
        githubLogin: "octocat",
        owner: "acme",
        repo: "web",
        issueNumber: 123,
        uuid: "uuid"
      })
    ).toBe("captures/2026/05/octocat/acme/web/issues/123/uuid.webp");
  });

  it("uploads WebP data URLs and returns public URLs", async () => {
    const send = vi.fn(async (_command: unknown) => undefined);
    const client = {
      send
    };

    await expect(
      uploadWebPScreenshotToR2({
        settings,
        githubLogin: "octocat",
        owner: "acme",
        repo: "web",
        issueNumber: 123,
        dataUrl: `data:image/webp;base64,${btoa("webp-bytes")}`,
        now: new Date("2026-05-31T12:00:00.000Z"),
        uuid: "uuid",
        client
      })
    ).resolves.toEqual({
      key: "captures/2026/05/octocat/acme/web/issues/123/uuid.webp",
      publicUrl:
        "https://assets.example.com/captures/2026/05/octocat/acme/web/issues/123/uuid.webp"
    });

    expect(client.send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0] as { input?: unknown } | undefined;
    expect(command?.input).toEqual(
      expect.objectContaining({
        Bucket: "bucket",
        Key: "captures/2026/05/octocat/acme/web/issues/123/uuid.webp",
        ContentType: "image/webp"
      })
    );
  });

  it("tests R2 access by uploading, verifying, and deleting a dummy image", async () => {
    const send = vi.fn(async (_command: unknown) => undefined);
    const client = {
      send
    };

    await expect(
      testR2Connection({
        settings,
        now: new Date("2026-05-31T12:00:00.000Z"),
        uuid: "test-uuid",
        client
      })
    ).resolves.toEqual({
      key: "snapissue-test/2026/05/test-uuid.webp",
      publicUrl: "https://assets.example.com/snapissue-test/2026/05/test-uuid.webp",
      deleted: true
    });

    expect(client.send).toHaveBeenCalledTimes(3);
    expect(
      send.mock.calls.map(
        ([command]) => (command as { constructor: { name: string } }).constructor.name
      )
    ).toEqual(["PutObjectCommand", "HeadObjectCommand", "DeleteObjectCommand"]);
    expect(
      send.mock.calls.map(([command]) => (command as { input: unknown }).input)
    ).toEqual([
      expect.objectContaining({
        Bucket: "bucket",
        Key: "snapissue-test/2026/05/test-uuid.webp",
        ContentType: "image/webp"
      }),
      {
        Bucket: "bucket",
        Key: "snapissue-test/2026/05/test-uuid.webp"
      },
      {
        Bucket: "bucket",
        Key: "snapissue-test/2026/05/test-uuid.webp"
      }
    ]);
  });

  it("builds scoped R2 test object keys", () => {
    expect(
      buildR2TestObjectKey({
        now: new Date("2026-06-01T00:00:00.000Z"),
        uuid: "abc"
      })
    ).toBe("snapissue-test/2026/06/abc.webp");
  });

  it("cleans up the dummy image when verification fails after upload", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("head failed"))
      .mockResolvedValueOnce(undefined);
    const client = {
      send
    };

    await expect(
      testR2Connection({
        settings,
        now: new Date("2026-05-31T12:00:00.000Z"),
        uuid: "cleanup-uuid",
        client
      })
    ).rejects.toThrow("head failed");

    expect(send.mock.calls.map(([command]) => (command as { input: unknown }).input)).toEqual([
      expect.objectContaining({
        Bucket: "bucket",
        Key: "snapissue-test/2026/05/cleanup-uuid.webp"
      }),
      {
        Bucket: "bucket",
        Key: "snapissue-test/2026/05/cleanup-uuid.webp"
      },
      {
        Bucket: "bucket",
        Key: "snapissue-test/2026/05/cleanup-uuid.webp"
      }
    ]);
  });

  it("rejects non-WebP data URLs", () => {
    expect(() => dataUrlToUint8Array("data:image/png;base64,abc")).toThrow(
      "Expected a WebP data URL."
    );
  });
});

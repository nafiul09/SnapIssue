import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { R2Settings } from "../shared/r2Settings";

export type R2UploadInput = {
  settings: R2Settings;
  githubLogin: string;
  owner: string;
  repo: string;
  issueNumber: number;
  dataUrl: string;
  now?: Date;
  uuid?: string;
  client?: {
    send(command: PutObjectCommand): Promise<unknown>;
  };
};

export type R2UploadResult = {
  key: string;
  publicUrl: string;
};

export async function uploadWebPScreenshotToR2({
  settings,
  githubLogin,
  owner,
  repo,
  issueNumber,
  dataUrl,
  now = new Date(),
  uuid = crypto.randomUUID(),
  client = createR2Client(settings)
}: R2UploadInput): Promise<R2UploadResult> {
  const key = buildR2ObjectKey({
    now,
    githubLogin,
    owner,
    repo,
    issueNumber,
    uuid
  });
  const body = dataUrlToUint8Array(dataUrl);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucketName,
      Key: key,
      Body: body,
      ContentType: "image/webp"
    })
  );

  return {
    key,
    publicUrl: `${settings.publicBaseUrl}/${key}`
  };
}

export function buildR2ObjectKey({
  now,
  githubLogin,
  owner,
  repo,
  issueNumber,
  uuid
}: {
  now: Date;
  githubLogin: string;
  owner: string;
  repo: string;
  issueNumber: number;
  uuid: string;
}): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return [
    "captures",
    year,
    month,
    safePathSegment(githubLogin),
    safePathSegment(owner),
    safePathSegment(repo),
    "issues",
    String(issueNumber),
    `${uuid}.webp`
  ].join("/");
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const [metadata, base64Payload] = dataUrl.split(",");
  if (!metadata?.includes("image/webp") || !base64Payload) {
    throw new Error("Expected a WebP data URL.");
  }

  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createR2Client(settings: R2Settings): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey
    },
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    region: "auto"
  });
}

function safePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

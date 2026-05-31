import { describe, expect, it } from "vitest";
import {
  buildR2SettingsExport,
  normalizeR2Settings,
  parseR2SettingsImport
} from "./r2Settings";

const validR2Settings = {
  accountId: "account",
  bucketName: "bucket",
  accessKeyId: "access",
  secretAccessKey: "secret",
  publicBaseUrl: "https://assets.example.com/"
};

describe("R2 settings", () => {
  it("normalizes required R2 fields and trims the public URL", () => {
    expect(normalizeR2Settings(validR2Settings)).toEqual({
      accountId: "account",
      bucketName: "bucket",
      accessKeyId: "access",
      secretAccessKey: "secret",
      publicBaseUrl: "https://assets.example.com"
    });
  });

  it("imports valid R2 JSON", () => {
    expect(parseR2SettingsImport(JSON.stringify(validR2Settings))).toEqual({
      accountId: "account",
      bucketName: "bucket",
      accessKeyId: "access",
      secretAccessKey: "secret",
      publicBaseUrl: "https://assets.example.com"
    });
  });

  it("rejects imports with missing required fields", () => {
    expect(() => parseR2SettingsImport('{"bucketName":"bucket"}')).toThrow(
      "R2 account ID is required."
    );
  });

  it("exports only R2 fields and excludes GitHub credentials", () => {
    const exported = buildR2SettingsExport({
      ...validR2Settings,
      githubToken: "token-should-not-export"
    } as typeof validR2Settings);

    expect(exported).toContain('"secretAccessKey": "secret"');
    expect(exported).not.toContain("github");
    expect(exported).not.toContain("token-should-not-export");
  });
});

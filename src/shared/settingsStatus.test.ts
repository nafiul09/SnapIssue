import { describe, expect, it } from "vitest";
import { deriveSetupStatus } from "./settingsStatus";

describe("deriveSetupStatus", () => {
  it("reports missing setup on first run", () => {
    expect(deriveSetupStatus({})).toEqual({
      githubConfigured: false,
      r2Configured: false,
      lastTargetLabel: "No recent repo",
      summary: "GitHub and R2 setup needed"
    });
  });

  it("treats a validated login as configured GitHub state", () => {
    expect(
      deriveSetupStatus({
        githubLogin: "nafiulislam",
        r2Settings: { bucketName: "snapissue" }
      }).summary
    ).toBe("Ready for capture");
  });

  it("formats the last successful owner and repo", () => {
    expect(
      deriveSetupStatus({
        lastSuccessfulTarget: {
          owner: "nafiul09",
          repo: "SnapIssue"
        }
      }).lastTargetLabel
    ).toBe("nafiul09/SnapIssue");
  });
});

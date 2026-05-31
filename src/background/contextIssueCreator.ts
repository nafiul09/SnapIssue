import {
  createGitHubIssue,
  updateGitHubIssueBody,
  type FetchLike
} from "../shared/githubClient";
import { uploadWebPScreenshotToR2 } from "./r2Uploader";
import { buildContextOnlyIssueBody, type IssueScreenshot } from "../shared/issueBody";
import { normalizeR2Settings, type R2Settings } from "../shared/r2Settings";
import type { CreateContextIssuePayload } from "../shared/runtimeMessages";
import { STORAGE_KEYS } from "../shared/storageKeys";

export type ContextIssueStorage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

export type ContextIssueResult =
  | {
      ok: true;
      issueNumber: number;
      issueUrl: string;
      warning?: string;
    }
  | {
      ok: false;
      reason: string;
    };

export async function createContextOnlyIssue(
  storage: ContextIssueStorage,
  payload: CreateContextIssuePayload,
  fetchImpl?: FetchLike,
  uploadScreenshot = uploadWebPScreenshotToR2
): Promise<ContextIssueResult> {
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      reason: validationError
    };
  }

  const snapshot = await storage.get([
    STORAGE_KEYS.githubToken,
    STORAGE_KEYS.githubLogin,
    STORAGE_KEYS.r2Settings
  ]);
  const token = snapshot[STORAGE_KEYS.githubToken];
  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      reason: "GitHub token is required."
    };
  }

  try {
    const bodyWithoutScreenshots = buildContextOnlyIssueBody({
      description: payload.description,
      context: payload.context
    });
    const issue = await createGitHubIssue(
      token,
      payload.owner,
      payload.repo,
      {
        title: payload.title,
        body: bodyWithoutScreenshots,
        labels: payload.labels
      },
      fetchImpl
    );

    await storage.set({
      [STORAGE_KEYS.lastSuccessfulTarget]: {
        owner: payload.owner,
        repo: payload.repo
      }
    });

    const screenshots = payload.screenshots ?? (payload.screenshot ? [payload.screenshot] : []);

    if (screenshots.length === 0) {
      return {
        ok: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url
      };
    }

    try {
      const r2Settings = normalizeR2Settings(
        snapshot[STORAGE_KEYS.r2Settings] as R2Settings
      );
      const githubLogin = readRequiredString(snapshot[STORAGE_KEYS.githubLogin]);
      const uploadedScreenshots: IssueScreenshot[] = [];

      for (const screenshot of screenshots) {
        const upload = await uploadScreenshot({
          settings: r2Settings,
          githubLogin,
          owner: payload.owner,
          repo: payload.repo,
          issueNumber: issue.number,
          dataUrl: screenshot.dataUrl
        });
        uploadedScreenshots.push({
          url: upload.publicUrl,
          clickX: screenshot.clickX,
          clickY: screenshot.clickY
        });
      }

      const finalBody = buildContextOnlyIssueBody({
        description: payload.description,
        context: payload.context,
        screenshots: uploadedScreenshots
      });

      await updateGitHubIssueBody(
        token,
        payload.owner,
        payload.repo,
        issue.number,
        finalBody,
        fetchImpl
      );

      return {
        ok: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url
      };
    } catch {
      return {
        ok: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        warning: "Issue created, screenshot failed."
      };
    }
  } catch {
    return {
      ok: false,
      reason: "GitHub issue creation failed. Check token access and retry."
    };
  }
}

function readRequiredString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Required setting is missing.");
  }
  return value;
}

function validatePayload(payload: CreateContextIssuePayload): string | null {
  if (!payload.title.trim()) {
    return "Issue title is required.";
  }

  if (!payload.owner.trim() || !payload.repo.trim()) {
    return "Owner and repo are required.";
  }

  return null;
}

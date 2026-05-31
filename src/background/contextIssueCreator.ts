import { createGitHubIssue, type FetchLike } from "../shared/githubClient";
import { buildContextOnlyIssueBody } from "../shared/issueBody";
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
    }
  | {
      ok: false;
      reason: string;
    };

export async function createContextOnlyIssue(
  storage: ContextIssueStorage,
  payload: CreateContextIssuePayload,
  fetchImpl?: FetchLike
): Promise<ContextIssueResult> {
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      reason: validationError
    };
  }

  const snapshot = await storage.get([STORAGE_KEYS.githubToken]);
  const token = snapshot[STORAGE_KEYS.githubToken];
  if (typeof token !== "string" || token.trim().length === 0) {
    return {
      ok: false,
      reason: "GitHub token is required."
    };
  }

  try {
    const issue = await createGitHubIssue(
      token,
      payload.owner,
      payload.repo,
      {
        title: payload.title,
        body: buildContextOnlyIssueBody({
          description: payload.description,
          context: payload.context
        }),
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

    return {
      ok: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url
    };
  } catch {
    return {
      ok: false,
      reason: "GitHub issue creation failed. Check token access and retry."
    };
  }
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

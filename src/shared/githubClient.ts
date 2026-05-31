import type { GitHubRepoSummary } from "./repoCatalog";

export type GitHubUser = {
  login: string;
};

export type GitHubLabel = {
  id: number;
  name: string;
  color: string;
  description: string | null;
};

export type GitHubIssue = {
  number: number;
  html_url: string;
};

export type CreateIssueInput = {
  title: string;
  body: string;
  labels: string[];
};

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export class GitHubValidationError extends Error {
  constructor(message = "GitHub token validation failed.") {
    super(message);
    this.name = "GitHubValidationError";
  }
}

export class GitHubApiError extends Error {
  constructor(message = "GitHub request failed.") {
    super(message);
    this.name = "GitHubApiError";
  }
}

export async function validateGitHubToken(
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<GitHubUser> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new GitHubValidationError("GitHub token is required.");
  }

  const response = await fetchImpl("https://api.github.com/user", {
    headers: githubHeaders(trimmedToken)
  });

  if (!response.ok) {
    throw new GitHubValidationError(
      response.status === 401
        ? "GitHub rejected this token."
        : "GitHub token validation failed."
    );
  }

  const payload = (await response.json()) as Partial<GitHubUser>;
  if (!payload.login || typeof payload.login !== "string") {
    throw new GitHubValidationError("GitHub did not return an authenticated user.");
  }

  return {
    login: payload.login
  };
}

export async function listAccessibleRepos(
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<GitHubRepoSummary[]> {
  const repos: GitHubRepoSummary[] = [];
  let page = 1;

  while (true) {
    const pageRepos = await githubJson<GitHubRepoSummary[]>(
      `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=full_name&per_page=100&page=${page}`,
      token,
      fetchImpl
    );

    repos.push(...pageRepos);

    if (pageRepos.length < 100) {
      return repos;
    }

    page += 1;
  }
}

export async function listGitHubLabels(
  token: string,
  owner: string,
  repo: string,
  fetchImpl: FetchLike = fetch
): Promise<GitHubLabel[]> {
  return githubJson<GitHubLabel[]>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/labels?per_page=100`,
    token,
    fetchImpl
  );
}

export async function createGitHubLabel(
  token: string,
  owner: string,
  repo: string,
  name: string,
  color: string,
  fetchImpl: FetchLike = fetch
): Promise<GitHubLabel> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new GitHubApiError("Label name is required.");
  }

  return githubJson<GitHubLabel>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/labels`,
    token,
    fetchImpl,
    {
      method: "POST",
      body: JSON.stringify({
        name: trimmedName,
        color
      })
    }
  );
}

export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  issue: CreateIssueInput,
  fetchImpl: FetchLike = fetch
): Promise<GitHubIssue> {
  const title = issue.title.trim();
  if (!title) {
    throw new GitHubApiError("Issue title is required.");
  }

  return githubJson<GitHubIssue>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/issues`,
    token,
    fetchImpl,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        body: issue.body,
        labels: issue.labels
      })
    }
  );
}

async function githubJson<T>(
  url: string,
  token: string,
  fetchImpl: FetchLike,
  init: RequestInit = {}
): Promise<T> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new GitHubApiError("GitHub token is required.");
  }

  const response = await fetchImpl(url, {
    ...init,
    headers: {
      ...githubHeaders(trimmedToken),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new GitHubApiError(
      response.status === 403
        ? "GitHub token does not have enough access."
        : "GitHub request failed."
    );
  }

  return (await response.json()) as T;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

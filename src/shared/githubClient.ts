export type GitHubUser = {
  login: string;
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

export async function validateGitHubToken(
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<GitHubUser> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw new GitHubValidationError("GitHub token is required.");
  }

  const response = await fetchImpl("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${trimmedToken}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
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

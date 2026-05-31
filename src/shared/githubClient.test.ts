import { describe, expect, it, vi } from "vitest";
import { GitHubValidationError, validateGitHubToken } from "./githubClient";

describe("validateGitHubToken", () => {
  it("calls the GitHub user API with a bearer token and returns the login", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ login: "octocat" }), { status: 200 })
    );

    await expect(validateGitHubToken(" token-value ", fetchImpl)).resolves.toEqual({
      login: "octocat"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-value"
        })
      })
    );
  });

  it("returns a sanitized validation error when GitHub rejects the token", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad token", { status: 401 }));

    await expect(validateGitHubToken("rejected-token", fetchImpl)).rejects.toThrow(
      GitHubValidationError
    );

    await expect(validateGitHubToken("rejected-token", fetchImpl)).rejects.not.toThrow(
      "rejected-token"
    );
  });

  it("requires GitHub to return an authenticated login", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await expect(validateGitHubToken("token-value", fetchImpl)).rejects.toThrow(
      "GitHub did not return an authenticated user."
    );
  });
});

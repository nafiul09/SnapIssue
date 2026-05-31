import { describe, expect, it, vi } from "vitest";
import {
  GitHubApiError,
  GitHubValidationError,
  createGitHubIssue,
  createGitHubLabel,
  listAccessibleRepos,
  listGitHubLabels,
  updateGitHubIssueBody,
  validateGitHubToken
} from "./githubClient";

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

describe("GitHub repo and label APIs", () => {
  it("lists accessible repositories with the saved token", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: "web",
            full_name: "acme/web",
            owner: { login: "acme" },
            private: true,
            archived: false,
            has_issues: true,
            html_url: "https://github.com/acme/web",
            permissions: { push: true }
          }
        ]),
        { status: 200 }
      )
    );

    await expect(listAccessibleRepos("token-value", fetchImpl)).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/user/repos?"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-value"
        })
      })
    );
  });

  it("loads labels for a selected repo", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([{ id: 10, name: "bug", color: "d73a4a", description: null }]),
        { status: 200 }
      )
    );

    await expect(
      listGitHubLabels("token-value", "acme", "web", fetchImpl)
    ).resolves.toEqual([
      { id: 10, name: "bug", color: "d73a4a", description: null }
    ]);
  });

  it("creates labels with generated colors without leaking tokens in errors", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 11,
          name: "needs-design",
          color: "123abc",
          description: null
        }),
        { status: 201 }
      )
    );

    await expect(
      createGitHubLabel("token-value", "acme", "web", "needs-design", "123abc", fetchImpl)
    ).resolves.toEqual({
      id: 11,
      name: "needs-design",
      color: "123abc",
      description: null
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/web/labels",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "needs-design", color: "123abc" })
      })
    );
  });

  it("sanitizes GitHub API failures", async () => {
    const fetchImpl = vi.fn(async () => new Response("denied", { status: 403 }));

    await expect(listAccessibleRepos("token-value", fetchImpl)).rejects.toThrow(
      GitHubApiError
    );
    await expect(listAccessibleRepos("token-value", fetchImpl)).rejects.not.toThrow(
      "token-value"
    );
  });

  it("creates context-only GitHub issues with selected labels", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          number: 123,
          html_url: "https://github.com/acme/web/issues/123"
        }),
        { status: 201 }
      )
    );

    await expect(
      createGitHubIssue(
        "token-value",
        "acme",
        "web",
        {
          title: "Broken button",
          body: "Body",
          labels: ["bug", "frontend"]
        },
        fetchImpl
      )
    ).resolves.toEqual({
      number: 123,
      html_url: "https://github.com/acme/web/issues/123"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/web/issues",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Broken button",
          body: "Body",
          labels: ["bug", "frontend"]
        })
      })
    );
  });

  it("updates GitHub issue bodies after screenshot upload", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          number: 123,
          html_url: "https://github.com/acme/web/issues/123"
        }),
        { status: 200 }
      )
    );

    await updateGitHubIssueBody(
      "token-value",
      "acme",
      "web",
      123,
      "Updated body",
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/web/issues/123",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ body: "Updated body" })
      })
    );
  });
});

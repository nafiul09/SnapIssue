import { describe, expect, it } from "vitest";
import { buildRepoCatalog, isEligibleIssueTarget } from "./repoCatalog";
import type { GitHubRepoSummary } from "./repoCatalog";

describe("repo catalog", () => {
  it("groups eligible repos by owner and preserves visibility", () => {
    const catalog = buildRepoCatalog(
      [
        repo({ ownerLogin: "acme", name: "web", private: true }),
        repo({ ownerLogin: "octocat", name: "public-api", private: false }),
        repo({ ownerLogin: "acme", name: "api", private: false })
      ],
      "2026-05-31T00:00:00.000Z"
    );

    expect(catalog).toEqual({
      fetchedAt: "2026-05-31T00:00:00.000Z",
      owners: [
        {
          owner: "acme",
          repos: [
            expect.objectContaining({ name: "api", private: false }),
            expect.objectContaining({ name: "web", private: true })
          ]
        },
        {
          owner: "octocat",
          repos: [expect.objectContaining({ name: "public-api", private: false })]
        }
      ]
    });
  });

  it("filters archived repos, repos with issues disabled, and read-only repos", () => {
    expect(isEligibleIssueTarget(repo({ archived: true }))).toBe(false);
    expect(isEligibleIssueTarget(repo({ has_issues: false }))).toBe(false);
    expect(
      isEligibleIssueTarget(
        repo({
          permissions: {
            pull: true,
            triage: false,
            push: false,
            maintain: false,
            admin: false
          }
        })
      )
    ).toBe(false);
    expect(isEligibleIssueTarget(repo({ permissions: { triage: true } }))).toBe(true);
  });
});

type RepoOverrides = Partial<Omit<GitHubRepoSummary, "owner">> & {
  ownerLogin?: string;
};

function repo(overrides: RepoOverrides = {}): GitHubRepoSummary {
  const owner = overrides.ownerLogin ?? "octocat";
  const name = overrides.name ?? "repo";

  return {
    id: overrides.id ?? 1,
    name,
    full_name: overrides.full_name ?? `${owner}/${name}`,
    owner: {
      login: owner
    },
    private: overrides.private ?? false,
    archived: overrides.archived ?? false,
    has_issues: overrides.has_issues ?? true,
    html_url: overrides.html_url ?? `https://github.com/${owner}/${name}`,
    permissions: overrides.permissions ?? { push: true }
  };
}

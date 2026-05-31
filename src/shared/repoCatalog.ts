export type GitHubRepoPermissions = {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
};

export type GitHubRepoSummary = {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  archived: boolean;
  has_issues: boolean;
  html_url: string;
  permissions?: GitHubRepoPermissions;
};

export type RepoCatalogEntry = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
};

export type RepoOwnerGroup = {
  owner: string;
  repos: RepoCatalogEntry[];
};

export type RepoCatalogCache = {
  fetchedAt: string;
  owners: RepoOwnerGroup[];
};

export function buildRepoCatalog(
  repos: GitHubRepoSummary[],
  fetchedAt = new Date().toISOString()
): RepoCatalogCache {
  const eligibleRepos = repos
    .filter(isEligibleIssueTarget)
    .map(toCatalogEntry)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const ownerMap = new Map<string, RepoCatalogEntry[]>();
  for (const repo of eligibleRepos) {
    const ownerRepos = ownerMap.get(repo.owner) ?? [];
    ownerRepos.push(repo);
    ownerMap.set(repo.owner, ownerRepos);
  }

  return {
    fetchedAt,
    owners: Array.from(ownerMap.entries())
      .map(([owner, ownerRepos]) => ({
        owner,
        repos: ownerRepos.sort((left, right) => left.name.localeCompare(right.name))
      }))
      .sort((left, right) => left.owner.localeCompare(right.owner))
  };
}

export function isEligibleIssueTarget(repo: GitHubRepoSummary): boolean {
  return !repo.archived && repo.has_issues && canCreateIssues(repo.permissions);
}

export function findRepoInCatalog(
  catalog: RepoCatalogCache | null,
  fullName: string
): RepoCatalogEntry | null {
  if (!catalog) {
    return null;
  }

  for (const owner of catalog.owners) {
    const repo = owner.repos.find((candidate) => candidate.fullName === fullName);
    if (repo) {
      return repo;
    }
  }

  return null;
}

function toCatalogEntry(repo: GitHubRepoSummary): RepoCatalogEntry {
  return {
    id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    htmlUrl: repo.html_url
  };
}

function canCreateIssues(permissions: GitHubRepoPermissions | undefined): boolean {
  if (!permissions) {
    return true;
  }

  return Boolean(
    permissions.admin ||
      permissions.maintain ||
      permissions.push ||
      permissions.triage
  );
}

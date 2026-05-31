export type SettingsSnapshot = {
  githubToken?: unknown;
  githubLogin?: unknown;
  r2Settings?: unknown;
  lastSuccessfulTarget?: unknown;
};

export type SetupStatus = {
  githubConfigured: boolean;
  r2Configured: boolean;
  lastTargetLabel: string;
  summary: string;
};

type LastTarget = {
  owner: string;
  repo: string;
};

export function deriveSetupStatus(snapshot: SettingsSnapshot): SetupStatus {
  const githubConfigured =
    isNonEmptyString(snapshot.githubToken) || isNonEmptyString(snapshot.githubLogin);
  const r2Configured = isPlainObject(snapshot.r2Settings);
  const lastTarget = parseLastTarget(snapshot.lastSuccessfulTarget);

  if (githubConfigured && r2Configured) {
    return {
      githubConfigured,
      r2Configured,
      lastTargetLabel: formatLastTarget(lastTarget),
      summary: "Ready for capture"
    };
  }

  const missing = [
    githubConfigured ? null : "GitHub",
    r2Configured ? null : "R2"
  ].filter(Boolean);

  return {
    githubConfigured,
    r2Configured,
    lastTargetLabel: formatLastTarget(lastTarget),
    summary: `${missing.join(" and ")} setup needed`
  };
}

function parseLastTarget(value: unknown): LastTarget | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const owner = value.owner;
  const repo = value.repo;

  if (!isNonEmptyString(owner) || !isNonEmptyString(repo)) {
    return null;
  }

  return { owner, repo };
}

function formatLastTarget(target: LastTarget | null): string {
  return target ? `${target.owner}/${target.repo}` : "No recent repo";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

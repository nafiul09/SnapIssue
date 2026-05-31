export const DEFAULT_SENSITIVE_DOMAIN_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "*.internal",
  "*.admin",
  "mail.google.com",
  "bank",
  "stripe.com"
] as const;

export type SensitiveDomainMatch = {
  host: string;
  pattern: string;
};

export function parseSensitiveDomainText(text: string): string[] {
  return normalizeSensitiveDomainPatterns(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );
}

export function formatSensitiveDomainText(patterns: string[]): string {
  return normalizeSensitiveDomainPatterns(patterns).join("\n");
}

export function normalizeSensitiveDomainPatterns(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : [...DEFAULT_SENSITIVE_DOMAIN_PATTERNS];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of source) {
    if (typeof item !== "string") {
      continue;
    }

    const pattern = item.trim().toLowerCase();
    if (!pattern || seen.has(pattern)) {
      continue;
    }

    seen.add(pattern);
    normalized.push(pattern);
  }

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_SENSITIVE_DOMAIN_PATTERNS];
}

export function findSensitiveDomainMatch(
  url: string,
  patterns: string[]
): SensitiveDomainMatch | null {
  const host = hostnameFromUrl(url);
  if (!host) {
    return null;
  }

  for (const pattern of normalizeSensitiveDomainPatterns(patterns)) {
    if (matchesPattern(host, pattern)) {
      return { host, pattern };
    }
  }

  return null;
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function matchesPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    return host.endsWith(`.${suffix}`);
  }

  if (!pattern.includes(".")) {
    return host === pattern || host.includes(pattern);
  }

  return host === pattern || host.endsWith(`.${pattern}`);
}

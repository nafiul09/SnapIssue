import { describe, expect, it } from "vitest";
import {
  DEFAULT_SENSITIVE_DOMAIN_PATTERNS,
  findSensitiveDomainMatch,
  formatSensitiveDomainText,
  normalizeSensitiveDomainPatterns,
  parseSensitiveDomainText
} from "./sensitiveDomains";

describe("sensitive domain matching", () => {
  it("matches exact hosts and subdomains for dotted patterns", () => {
    expect(
      findSensitiveDomainMatch("https://mail.google.com/inbox", ["mail.google.com"])
    ).toEqual({
      host: "mail.google.com",
      pattern: "mail.google.com"
    });
    expect(
      findSensitiveDomainMatch("https://dashboard.stripe.com/test", ["stripe.com"])
    ).toEqual({
      host: "dashboard.stripe.com",
      pattern: "stripe.com"
    });
  });

  it("matches wildcard-like internal hosts", () => {
    expect(
      findSensitiveDomainMatch("https://console.service.internal", ["*.internal"])
    ).toEqual({
      host: "console.service.internal",
      pattern: "*.internal"
    });
  });

  it("matches localhost, IP addresses, and keyword patterns", () => {
    expect(findSensitiveDomainMatch("http://localhost:5173", ["localhost"])).toEqual({
      host: "localhost",
      pattern: "localhost"
    });
    expect(findSensitiveDomainMatch("http://127.0.0.1:3000", ["127.0.0.1"])).toEqual({
      host: "127.0.0.1",
      pattern: "127.0.0.1"
    });
    expect(findSensitiveDomainMatch("https://secure-bank.example", ["bank"])).toEqual({
      host: "secure-bank.example",
      pattern: "bank"
    });
  });

  it("does not match unrelated domains", () => {
    expect(
      findSensitiveDomainMatch("https://example.com", ["stripe.com", "*.admin"])
    ).toBeNull();
  });

  it("normalizes editable pattern text and falls back to defaults", () => {
    expect(parseSensitiveDomainText(" Stripe.com \nstripe.com\n*.Admin ")).toEqual([
      "stripe.com",
      "*.admin"
    ]);
    expect(formatSensitiveDomainText(["stripe.com", "bank"])).toBe(
      "stripe.com\nbank"
    );
    expect(normalizeSensitiveDomainPatterns([])).toEqual([
      ...DEFAULT_SENSITIVE_DOMAIN_PATTERNS
    ]);
  });
});

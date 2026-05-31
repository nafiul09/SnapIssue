import { describe, expect, it } from "vitest";
import { generateLabelColor } from "./labelColor";

describe("generateLabelColor", () => {
  it("returns deterministic six-character GitHub label colors", () => {
    expect(generateLabelColor("frontend")).toMatch(/^[0-9a-f]{6}$/);
    expect(generateLabelColor("frontend")).toBe(generateLabelColor(" frontend "));
  });

  it("varies colors for different label names", () => {
    expect(generateLabelColor("frontend")).not.toBe(generateLabelColor("backend"));
  });
});

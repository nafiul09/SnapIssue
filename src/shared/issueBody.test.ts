import { describe, expect, it } from "vitest";
import { buildContextOnlyIssueBody } from "./issueBody";

const context = {
  url: "https://example.com/page",
  title: "Example Page",
  capturedAt: "2026-05-31T12:00:00.000Z",
  viewportWidth: 1440,
  viewportHeight: 900,
  clickX: 321,
  clickY: 222
};

describe("buildContextOnlyIssueBody", () => {
  it("puts the user description before generated context", () => {
    expect(
      buildContextOnlyIssueBody({
        description: "The primary button is clipped.",
        context
      })
    ).toBe(`The primary button is clipped.

## Context

- Page: https://example.com/page
- Title: Example Page
- Captured at: 2026-05-31T12:00:00.000Z
- Viewport: 1440x900
- Click: x=321, y=222
`);
  });

  it("creates a valid context-only body when description is empty", () => {
    expect(
      buildContextOnlyIssueBody({
        description: "  ",
        context
      }).startsWith("## Context")
    ).toBe(true);
  });

  it("appends screenshot Markdown before generated context", () => {
    const body = buildContextOnlyIssueBody({
      description: "Screenshot attached.",
      context,
      screenshots: [
        {
          url: "https://assets.example.com/capture.webp",
          clickX: 321,
          clickY: 222
        }
      ]
    });

    expect(body).toContain("## Screenshots");
    expect(body).toContain(
      "![Screenshot 1](https://assets.example.com/capture.webp)"
    );
    expect(body).toContain("Click: x=321, y=222");
    expect(body.indexOf("## Screenshots")).toBeLessThan(body.indexOf("## Context"));
  });

  it("keeps multiple screenshots and click coordinates in the chosen order", () => {
    const body = buildContextOnlyIssueBody({
      description: "Screenshots attached.",
      context,
      screenshots: [
        {
          url: "https://assets.example.com/second-position.webp",
          clickX: 22,
          clickY: 44
        },
        {
          url: "https://assets.example.com/first-position.webp",
          clickX: 88,
          clickY: 99
        }
      ]
    });

    expect(body.indexOf("second-position.webp")).toBeLessThan(
      body.indexOf("first-position.webp")
    );
    expect(body).toContain("### Screenshot 1");
    expect(body).toContain("Click: x=22, y=44");
    expect(body).toContain("### Screenshot 2");
    expect(body).toContain("Click: x=88, y=99");
  });
});

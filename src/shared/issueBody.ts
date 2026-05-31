import type { CapturedPageContext } from "./runtimeMessages";

export type ContextOnlyIssueBodyInput = {
  description: string;
  context: CapturedPageContext;
  screenshots?: IssueScreenshot[];
};

export type IssueScreenshot = {
  url: string;
  clickX: number;
  clickY: number;
};

export function buildContextOnlyIssueBody({
  description,
  context,
  screenshots = []
}: ContextOnlyIssueBodyInput): string {
  const sections = [
    description.trim(),
    buildScreenshotsSection(screenshots),
    buildContextSection(context)
  ].filter((section) => section.length > 0);

  return `${sections.join("\n\n")}\n`;
}

function buildScreenshotsSection(screenshots: IssueScreenshot[]): string {
  if (screenshots.length === 0) {
    return "";
  }

  return [
    "## Screenshots",
    "",
    buildScreenshotMarkdownLinks(screenshots)
  ]
    .join("\n")
    .trim();
}

export function buildScreenshotMarkdownLinks(
  screenshots: IssueScreenshot[]
): string {
  return screenshots
    .flatMap((screenshot, index) => [
      `### Screenshot ${index + 1}`,
      `![Screenshot ${index + 1}](${screenshot.url})`,
      "",
      `Click: x=${screenshot.clickX}, y=${screenshot.clickY}`,
      ""
    ])
    .join("\n")
    .trim();
}

function buildContextSection(context: CapturedPageContext): string {
  return [
    "## Context",
    "",
    `- Page: ${context.url}`,
    `- Title: ${context.title}`,
    `- Captured at: ${context.capturedAt}`,
    `- Viewport: ${context.viewportWidth}x${context.viewportHeight}`,
    `- Click: x=${context.clickX}, y=${context.clickY}`
  ].join("\n");
}

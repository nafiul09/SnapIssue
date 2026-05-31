import type { CapturedPageContext } from "./runtimeMessages";

export type ContextOnlyIssueBodyInput = {
  description: string;
  context: CapturedPageContext;
};

export function buildContextOnlyIssueBody({
  description,
  context
}: ContextOnlyIssueBodyInput): string {
  const sections = [description.trim(), buildContextSection(context)].filter(
    (section) => section.length > 0
  );

  return `${sections.join("\n\n")}\n`;
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

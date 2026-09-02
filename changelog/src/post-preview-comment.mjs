import { readFileSync } from "node:fs";

import { output } from "../../git/src/command.mjs";
import { eventPayload, fail } from "../../git/src/workflow.mjs";

const marker = "<!-- git-cliff-preview -->";

function readPreview() {
  try {
    const content = readFileSync("PREVIEW.md", "utf8").trim();
    return content || "_No unreleased changes detected._";
  } catch {
    return "_No unreleased changes detected._";
  }
}

export function postPreviewComment() {
  const issueNumber = eventPayload().pull_request?.number;
  if (!issueNumber) {
    fail("No pull request number found in the workflow context.");
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const body = `${marker}\n## Changelog preview\n\n${readPreview()}`;

  const comments = JSON.parse(
    output("gh", ["api", `/repos/${repo}/issues/${issueNumber}/comments`]),
  );
  const existing = comments.find((comment) => comment.body.includes(marker));

  if (existing) {
    output("gh", [
      "api",
      "--method",
      "PATCH",
      `/repos/${repo}/issues/comments/${existing.id}`,
      "-f",
      `body=${body}`,
    ]);
  } else {
    output("gh", [
      "api",
      "--method",
      "POST",
      `/repos/${repo}/issues/${issueNumber}/comments`,
      "-f",
      `body=${body}`,
    ]);
  }
}

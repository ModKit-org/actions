import { output } from "../../git/src/command.mjs";

function normalizeLabels(labels) {
  return labels
    .split(/[\n,]+/)
    .map((label) => label.trim())
    .filter(Boolean);
}

export function findOpenPr(branch) {
  return output("gh", [
    "pr",
    "list",
    "--head",
    branch,
    "--state",
    "open",
    "--json",
    "number",
    "--jq",
    ".[0].number",
  ]);
}

export function createOrUpdatePr({ branch, baseBranch, title, body, labels }) {
  const existing = findOpenPr(branch);

  if (existing) {
    const addLabelArgs = normalizeLabels(labels).flatMap((label) => [
      "--add-label",
      label,
    ]);
    output("gh", [
      "pr",
      "edit",
      existing,
      "--title",
      title,
      "--body",
      body,
      ...addLabelArgs,
    ]);
    return { number: existing, created: false };
  }

  const labelArgs = normalizeLabels(labels).flatMap((label) => [
    "--label",
    label,
  ]);
  output("gh", [
    "pr",
    "create",
    "--base",
    baseBranch,
    "--head",
    branch,
    "--title",
    title,
    "--body",
    body,
    ...labelArgs,
  ]);

  return { number: findOpenPr(branch), created: true };
}

export function prUrl(number) {
  return output("gh", [
    "pr",
    "view",
    String(number),
    "--json",
    "url",
    "--jq",
    ".url",
  ]);
}

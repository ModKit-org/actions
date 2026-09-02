import { readFileSync } from "node:fs";

import { command, output } from "../../git/src/command.mjs";
import { fail, input } from "../../git/src/workflow.mjs";

export function createReleasePr() {
  const tag = input("tag-name").trim();
  const prerelease = input("prerelease").trim() === "true";
  const changelogFile = input("changelog-file").trim() || "CHANGELOG.md";
  const prLabel = input("pr-label").trim() || "automated";
  const config = input("config").trim();
  const repo = process.env.GITHUB_REPOSITORY;
  const refName = process.env.GITHUB_REF_NAME;

  const diff = command("git", ["diff", "--quiet", "--", changelogFile], {
    allowFailure: true,
  });
  if (diff.status === 0) {
    fail(
      `No changelog changes detected for ${tag}. Possible causes:\n` +
        "  - No unreleased commits exist since the last tag\n" +
        "  - All commits since the last tag were filtered out by cliff.toml commit_parsers\n" +
        "  - Commits use non-conventional format and are caught by the catch-all skip rule\n" +
        `Run 'git-cliff --unreleased --config ${config} -vv' locally to debug`,
    );
  }

  const branchName = `changelog/${tag}`;
  const baseSha = JSON.parse(
    output("gh", ["api", `/repos/${repo}/git/ref/heads/${refName}`]),
  ).object.sha;

  output("gh", [
    "api",
    "--method",
    "POST",
    `/repos/${repo}/git/refs`,
    "-f",
    `ref=refs/heads/${branchName}`,
    "-f",
    `sha=${baseSha}`,
  ]);

  const content = readFileSync(changelogFile, "utf8");
  const encodedContent = Buffer.from(content, "utf8").toString("base64");

  const existingSha = output(
    "gh",
    [
      "api",
      `/repos/${repo}/contents/${changelogFile}?ref=${baseSha}`,
      "--jq",
      ".sha",
    ],
    { allowFailure: true },
  );

  const putArgs = [
    "api",
    "--method",
    "PUT",
    `/repos/${repo}/contents/${changelogFile}`,
    "-f",
    `message=chore(release): update ${changelogFile} for ${tag}`,
    "-f",
    `content=${encodedContent}`,
    "-f",
    `branch=${branchName}`,
  ];
  if (existingSha) {
    putArgs.push("-f", `sha=${existingSha}`);
  }
  output("gh", putArgs);

  let body = `Automated changelog update for release **${tag}**.`;
  body +=
    "\n\nOnce this PR is merged, the tag and GitHub release will be created automatically.";
  if (prerelease) {
    body +=
      "\n\n> **Pre-release**: this version will be marked as a pre-release.";
  }

  command(
    "gh",
    [
      "pr",
      "create",
      "--base",
      refName,
      "--head",
      branchName,
      "--title",
      `chore(release): update ${changelogFile} for ${tag}`,
      "--body",
      body,
      "--label",
      prLabel,
    ],
    { stdio: "inherit" },
  );
}

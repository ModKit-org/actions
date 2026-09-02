import { createOrUpdatePr, prUrl } from "../../create-pr/src/gh.mjs";
import {
  checkoutBranch,
  commitChanges,
  configureAuthor,
  fetchRemote,
  hasStagedChanges,
  pushBranch,
  stage,
} from "../../git/src/git.mjs";
import { fail, input, notice } from "../../git/src/workflow.mjs";
import { prependChangelog } from "./prepend-changelog.mjs";

const defaultAuthorName = "github-actions[bot]";
const defaultAuthorEmail = "github-actions[bot]@users.noreply.github.com";

export function createReleasePr() {
  const tag = input("tag-name").trim();
  const prerelease = input("prerelease").trim() === "true";
  const changelogFile = input("changelog-file").trim() || "CHANGELOG.md";
  const prLabel = input("pr-label").trim() || "automated";
  const config = input("config").trim();
  const baseBranch = process.env.GITHUB_REF_NAME;
  const branch = `changelog/${tag}`;

  configureAuthor(
    input("git-user-name").trim() || defaultAuthorName,
    input("git-user-email").trim() || defaultAuthorEmail,
  );

  fetchRemote(baseBranch);
  checkoutBranch(branch, true, baseBranch);

  prependChangelog();
  stage([changelogFile]);

  if (!hasStagedChanges()) {
    fail(
      `No changelog changes detected for ${tag}. Possible causes:\n` +
        "  - No unreleased commits exist since the last tag\n" +
        "  - All commits since the last tag were filtered out by cliff.toml commit_parsers\n" +
        "  - Commits use non-conventional format and are caught by the catch-all skip rule\n" +
        `Run 'git-cliff --unreleased --config ${config} -vv' locally to debug`,
    );
  }

  const commitMessage = `chore(release): update ${changelogFile} for ${tag}`;
  commitChanges(commitMessage, false, false);
  pushBranch(branch, true);

  let body = `Automated changelog update for release **${tag}**.`;
  body +=
    "\n\nOnce this PR is merged, the tag and GitHub release will be created automatically.";
  if (prerelease) {
    body +=
      "\n\n> **Pre-release**: this version will be marked as a pre-release.";
  }

  const { number, created } = createOrUpdatePr({
    branch,
    baseBranch,
    title: commitMessage,
    body,
    labels: prLabel,
  });

  notice(
    `${created ? "Created" : "Updated"} PR #${number} (${prUrl(number)}).`,
  );
}

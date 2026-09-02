#!/usr/bin/env node

import { appendFileSync } from "node:fs";

import { fail, input, notice, setOutput } from "../../git/src/workflow.mjs";
import {
  checkoutBranch,
  commitChanges,
  configureAuthor,
  deleteRemoteBranch,
  fetchRemote,
  hasStagedChanges,
  parsePaths,
  pushBranch,
  remoteBranchExists,
  stage,
  stagedFiles,
} from "../../git/src/git.mjs";
import { createGitHubSignedCommit } from "../../git/src/github-commit.mjs";
import {
  cleanupSigningMaterial,
  configureSigning,
  validateSigningInputs,
} from "../../git/src/signing.mjs";
import { createOrUpdatePr, findOpenPr, prUrl } from "./gh.mjs";

const defaultAuthorName = "github-actions[bot]";
const defaultAuthorEmail = "github-actions[bot]@users.noreply.github.com";

function validateInputs(branch, baseBranch, signingMethod) {
  if (!branch) {
    fail("Input 'branch' is required.");
  }
  if (!baseBranch) {
    fail("Input 'base-branch' could not be resolved. Provide it explicitly.");
  }
  if (branch === baseBranch) {
    fail(
      `Input 'branch' (${branch}) must differ from 'base-branch' (${baseBranch}).`,
    );
  }

  validateSigningInputs(signingMethod);
}

function writeSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${lines.join("\n")}\n`,
      "utf8",
    );
  }
}

let pushed = false;

function main() {
  process.env.GH_TOKEN = input("github-token");

  const branch = input("branch").trim();
  const baseBranch = input("base-branch").trim();
  const commitMessage = input("commit-message");
  const skipIfNoChanges = input("skip-if-no-changes").trim() === "true";
  const resetBranch = input("reset-branch").trim() === "true";
  const signingMethod = input("signing-method").trim() || "none";
  const noVerify = input("no-verify").trim() === "true";

  validateInputs(branch, baseBranch, signingMethod);
  setOutput("branch", branch);

  configureAuthor(
    input("git-user-name").trim() || defaultAuthorName,
    input("git-user-email").trim() || defaultAuthorEmail,
  );

  fetchRemote(baseBranch);
  fetchRemote(branch);
  checkoutBranch(branch, resetBranch, baseBranch);

  if (signingMethod === "github") {
    // GitHub signing commits via the Contents API, which requires origin/branch to already match HEAD.
    pushBranch(branch, true);
  }

  stage(parsePaths(input("paths")));

  if (!hasStagedChanges()) {
    setOutput("created", "false");
    setOutput("updated", "false");
    if (skipIfNoChanges) {
      notice("No changes to commit, skipping PR creation.");
      setOutput("changes-committed", "false");
      return;
    }
    fail("No changes to commit.");
  }

  if (signingMethod === "github") {
    createGitHubSignedCommit(branch, commitMessage, stagedFiles());
  } else {
    Object.assign(process.env, configureSigning(signingMethod));
    commitChanges(commitMessage, signingMethod !== "none", noVerify);
    pushBranch(branch, true);
  }
  pushed = true;
  setOutput("changes-committed", "true");

  const { number, created } = createOrUpdatePr({
    branch,
    baseBranch,
    title: input("pr-title").trim() || commitMessage,
    body: input("pr-body"),
    labels: input("labels"),
  });

  const url = prUrl(number);
  setOutput("pr-number", number);
  setOutput("pr-url", url);
  setOutput("created", created ? "true" : "false");
  setOutput("updated", created ? "false" : "true");

  writeSummary([
    "## Pull request",
    "",
    `- Branch: \`${branch}\` → \`${baseBranch}\``,
    `- PR: [#${number}](${url})`,
  ]);

  notice(created ? `Created PR #${number}.` : `Updated PR #${number}.`);
}

try {
  main();
} catch (error) {
  console.log(`::error::${error.message}`);
  process.exitCode = 1;

  if (pushed && input("delete-branch-on-failure").trim() === "true") {
    const branch = input("branch").trim();
    if (findOpenPr(branch)) {
      notice(`Open PR exists for ${branch}; leaving branch in place.`);
    } else if (remoteBranchExists(branch)) {
      notice(`Deleting remote branch ${branch} after failure.`);
      deleteRemoteBranch(branch);
    } else {
      notice(`Remote branch ${branch} no longer exists; nothing to clean up.`);
    }
  }
} finally {
  cleanupSigningMaterial();
}

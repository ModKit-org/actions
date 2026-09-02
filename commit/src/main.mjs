#!/usr/bin/env node

import {
  commitWithGit,
  configureAuthor,
  currentBranch,
  parsePaths,
  pushCurrentBranch,
  stage,
  stagedFiles,
} from "./git.mjs";
import { createGitHubSignedCommit } from "./github-commit.mjs";
import {
  cleanupSigningMaterial,
  configureSigning,
  validateSigningInputs,
} from "./signing.mjs";
import { fail, input, notice, setOutput } from "../../git/src/workflow.mjs";

const defaultAuthorName = "github-actions[bot]";
const defaultAuthorEmail = "github-actions[bot]@users.noreply.github.com";

function validateInputs(signingMethod) {
  if (!input("commit-message").trim()) {
    fail("Input 'commit-message' is required.");
  }

  if (!input("github-token").trim()) {
    fail("Input 'github-token' is required.");
  }

  validateSigningInputs(signingMethod);
}

function writeNoChangesOutputs() {
  notice("No changes to commit.");
  setOutput("committed", "false");
  setOutput("commit-sha", "");
  setOutput("pushed", "false");
}

function main() {
  const signingMethod = input("signing-method").trim() || "none";
  validateInputs(signingMethod);

  const branch = currentBranch();
  const authorName = input("git-user-name").trim() || defaultAuthorName;
  const authorEmail = input("git-user-email").trim() || defaultAuthorEmail;

  configureAuthor(authorName, authorEmail);

  stage(parsePaths(input("paths")));
  const files = stagedFiles();
  if (files.length === 0) {
    writeNoChangesOutputs();
    return;
  }

  let commitSha;
  if (signingMethod === "github") {
    commitSha = createGitHubSignedCommit(
      branch,
      input("commit-message"),
      files,
    );
  } else {
    Object.assign(process.env, configureSigning(signingMethod));
    commitSha = commitWithGit(
      input("commit-message"),
      signingMethod !== "none",
    );
    pushCurrentBranch(branch, input("force-push").trim() === "true");
  }

  setOutput("committed", "true");
  setOutput("commit-sha", commitSha);
  setOutput("pushed", "true");
  notice(`Committed ${commitSha} to ${branch}.`);
}

try {
  main();
} catch (error) {
  console.log(`::error::${error.message}`);
  process.exitCode = 1;
} finally {
  cleanupSigningMaterial();
}

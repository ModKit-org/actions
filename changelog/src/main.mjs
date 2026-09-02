#!/usr/bin/env node

import { command } from "../../git/src/command.mjs";
import { input, run } from "../../git/src/workflow.mjs";
import { createReleasePr } from "./create-release-pr.mjs";
import { generatePreview } from "./generate-preview.mjs";
import { installGitCliff } from "./install-git-cliff.mjs";
import { postPreviewComment } from "./post-preview-comment.mjs";
import { resolveMode } from "./resolve-mode.mjs";
import { validateTagAvailable } from "./validate-tag.mjs";

async function main() {
  process.env.GH_TOKEN = input("github-token");

  const mode = resolveMode();

  command("git", ["fetch", "--unshallow"], { allowFailure: true });
  command("git", ["fetch", "--tags", "--force"]);

  await installGitCliff();

  if (mode === "preview") {
    generatePreview();
    postPreviewComment();
  } else {
    validateTagAvailable();
    createReleasePr();
  }
}

run(main);

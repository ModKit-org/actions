import { writeFileSync } from "node:fs";

import { command } from "../../git/src/command.mjs";
import { input } from "../../git/src/workflow.mjs";

export function generatePreview() {
  const config = input("config").trim();
  const args = ["--verbose", "--unreleased", "--strip", "header", "-vv"];
  if (config) {
    args.unshift("--config", config);
  }

  const result = command("git-cliff", args, {
    env: {
      GITHUB_TOKEN: input("github-token"),
      GITHUB_REPO: process.env.GITHUB_REPOSITORY,
    },
  });
  writeFileSync("PREVIEW.md", result.stdout, "utf8");
}

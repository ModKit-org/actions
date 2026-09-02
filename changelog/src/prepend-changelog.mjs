import { command } from "../../git/src/command.mjs";
import { input } from "../../git/src/workflow.mjs";

export function prependChangelog() {
  const config = input("config").trim();
  const tag = input("tag-name").trim();
  const changelogFile = input("changelog-file").trim() || "CHANGELOG.md";

  const args = [
    "--verbose",
    "--tag",
    tag,
    "--unreleased",
    "--prepend",
    changelogFile,
  ];
  if (config) {
    args.unshift("--config", config);
  }

  command("git-cliff", args, {
    stdio: "inherit",
    env: {
      GITHUB_TOKEN: input("github-token"),
      GITHUB_REPO: process.env.GITHUB_REPOSITORY,
    },
  });
}

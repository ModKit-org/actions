import { command } from "../../git/src/command.mjs";
import { fail, input } from "../../git/src/workflow.mjs";

export function validateTagAvailable() {
  const tag = input("tag-name").trim();
  const result = command("git", ["rev-parse", `refs/tags/${tag}`], {
    allowFailure: true,
  });
  if (result.status === 0) {
    fail(`Tag ${tag} already exists. Use a different version.`);
  }
}

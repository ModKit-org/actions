import { fail, input } from "../../git/src/workflow.mjs";

export function resolveMode() {
  let mode = input("mode").trim();
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";
  const tag = input("tag-name").trim();

  if (!mode) {
    if (eventName === "pull_request") {
      mode = "preview";
    } else if (eventName === "workflow_dispatch") {
      mode = "release";
    } else {
      fail(
        `Unable to auto-detect mode for event '${eventName}'. Set the 'mode' input explicitly to 'preview' or 'release'.`,
      );
    }
  }

  if (mode !== "preview" && mode !== "release") {
    fail(`Invalid mode '${mode}'. Allowed values: preview, release.`);
  }

  if (mode === "release" && !tag) {
    fail("Input 'tag-name' is required when mode is 'release'.");
  }

  return mode;
}

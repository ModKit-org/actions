import { binaryOutput, command, output } from "./command.mjs";
import { fail, input } from "./workflow.mjs";

function githubContentPath(file) {
  return file.split("/").map(encodeURIComponent).join("/");
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function verifyGitHubSignature(commitSha, tokenEnvironment) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const verified = output(
      "gh",
      [
        "api",
        `/repos/${process.env.GITHUB_REPOSITORY}/git/commits/${commitSha}`,
        "--jq",
        ".verification.verified",
      ],
      { env: tokenEnvironment },
    );
    if (verified === "true") {
      return;
    }
    if (attempt < 5) {
      wait(2000);
    }
  }

  fail(
    `GitHub created commit ${commitSha}, but did not report it as verified.`,
  );
}

export function createGitHubSignedCommit(branch, message, files) {
  if (files.length !== 1) {
    fail(
      "signing-method 'github' supports exactly one staged file because GitHub's Contents API creates one signed commit per file. Use 'gpg' or 'ssh' for an atomic multi-file signed commit.",
    );
  }

  const file = files[0];
  const tokenEnvironment = { GH_TOKEN: input("github-token") };
  const remoteHead = output("git", ["rev-parse", `origin/${branch}`], {
    allowFailure: true,
  });
  if (!remoteHead) {
    fail(
      `Remote branch 'origin/${branch}' was not found. GitHub signing requires an existing remote branch.`,
    );
  }
  if (output("git", ["rev-parse", "HEAD"]) !== remoteHead) {
    fail(
      `Local HEAD does not match origin/${branch}. Fetch and rebase before creating a GitHub-signed commit.`,
    );
  }

  const status = output("git", ["diff", "--cached", "--name-status", "-z"]);
  const isDeleted = status.startsWith("D\0");
  const apiFile = githubContentPath(file);
  const existingSha = output(
    "gh",
    [
      "api",
      `/repos/${process.env.GITHUB_REPOSITORY}/contents/${apiFile}?ref=${encodeURIComponent(branch)}`,
      "--jq",
      ".sha",
    ],
    { allowFailure: true, env: tokenEnvironment },
  );

  let response;
  if (isDeleted) {
    if (!existingSha) {
      fail(
        `Cannot delete '${file}' because it does not exist on origin/${branch}.`,
      );
    }
    response = output(
      "gh",
      [
        "api",
        "--method",
        "DELETE",
        `/repos/${process.env.GITHUB_REPOSITORY}/contents/${apiFile}`,
        "-f",
        `message=${message}`,
        "-f",
        `sha=${existingSha}`,
        "-f",
        `branch=${branch}`,
      ],
      { env: tokenEnvironment },
    );
  } else {
    const content = binaryOutput("git", ["show", `:${file}`]).toString(
      "base64",
    );
    const args = [
      "api",
      "--method",
      "PUT",
      `/repos/${process.env.GITHUB_REPOSITORY}/contents/${apiFile}`,
      "-f",
      `message=${message}`,
      "-f",
      `content=${content}`,
      "-f",
      `branch=${branch}`,
    ];
    if (existingSha) {
      args.push("-f", `sha=${existingSha}`);
    }
    response = output("gh", args, { env: tokenEnvironment });
  }

  let result;
  try {
    result = JSON.parse(response);
  } catch {
    fail("GitHub returned an invalid Contents API response.");
  }

  const commitSha = result.commit?.sha;
  if (!commitSha) {
    fail("GitHub did not return a commit SHA for the Contents API update.");
  }

  command("git", ["fetch", "origin", branch]);
  if (output("git", ["rev-parse", `origin/${branch}`]) !== commitSha) {
    fail("GitHub did not update the branch with the signed commit SHA.");
  }

  verifyGitHubSignature(commitSha, tokenEnvironment);
  command("git", ["reset", "--hard", commitSha]);
  return commitSha;
}

import { binaryOutput, command, output } from "./command.mjs";
import { fail, input } from "./workflow.mjs";

const createCommitMutation = `
  mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      clientMutationId
    }
  }
`;

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
  const graphqlInput = [
    "api",
    "graphql",
    "-F",
    `input[branch][repositoryNameWithOwner]=${process.env.GITHUB_REPOSITORY}`,
    "-F",
    `input[branch][branchName]=${branch}`,
    "-F",
    `input[expectedHeadOid]=${remoteHead}`,
    "-F",
    `input[message][headline]=${message}`,
    "-F",
    `query=${createCommitMutation}`,
  ];

  if (isDeleted) {
    graphqlInput.push("-F", `input[fileChanges][deletions][0][path]=${file}`);
  } else {
    const content = binaryOutput("git", ["show", `:${file}`]).toString(
      "base64",
    );
    graphqlInput.push(
      "-F",
      `input[fileChanges][additions][0][path]=${file}`,
      "-F",
      `input[fileChanges][additions][0][contents]=${content}`,
    );
  }

  const response = output("gh", graphqlInput, { env: tokenEnvironment });
  let result;
  try {
    result = JSON.parse(response);
  } catch {
    fail("GitHub returned an invalid response for the signed commit request.");
  }

  const errors = result.errors
    ?.map((error) => error.message)
    .filter(Boolean)
    .join("; ");
  if (errors) {
    fail(`GitHub could not create the signed commit: ${errors}`);
  }

  if (!result.data?.createCommitOnBranch) {
    fail("GitHub did not confirm creation of the signed commit.");
  }

  command("git", ["fetch", "origin", branch]);
  const commitSha = output("git", ["rev-parse", `origin/${branch}`]);
  if (commitSha === remoteHead) {
    fail("GitHub did not update the branch with the signed commit.");
  }

  verifyGitHubSignature(commitSha, tokenEnvironment);
  command("git", ["reset", "--hard", commitSha]);
  return commitSha;
}

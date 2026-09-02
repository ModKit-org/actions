import { command, output } from "./command.mjs";
import { fail } from "./workflow.mjs";

export function configureIdentity(name, email) {
  command("git", ["config", "user.name", name]);
  command("git", ["config", "user.email", email]);
}

export function fetchRemote(branch) {
  command("git", ["fetch", "origin", branch], {
    allowFailure: true,
    stdio: "inherit",
  });
}

export function checkoutBranch(branch, reset, baseBranch) {
  if (reset) {
    command("git", ["checkout", "-B", branch, `origin/${baseBranch}`], {
      stdio: "inherit",
    });
    return;
  }

  command("git", ["checkout", "-B", branch], { stdio: "inherit" });
}

export function parsePaths(value) {
  const normalized = value.trim();
  if (!normalized || normalized === "-A") {
    return ["-A"];
  }

  return normalized.split(/[\r\n\t ]+/).filter(Boolean);
}

export function currentBranch() {
  const branch = output("git", ["branch", "--show-current"]);
  if (!branch) {
    fail("A checked-out branch is required; detached HEAD is not supported.");
  }

  return branch;
}

export function configureAuthor(name, email) {
  command("git", ["config", "--local", "user.name", name]);
  command("git", ["config", "--local", "user.email", email]);
}

export function stage(paths) {
  if (paths.length === 1 && paths[0] === "-A") {
    command("git", ["add", "-A"]);
    return;
  }

  command("git", ["add", "--", ...paths]);
}

export function stagedFiles() {
  return output("git", ["diff", "--cached", "--name-only", "-z"])
    .split("\0")
    .filter(Boolean);
}

export function commitWithGit(message, shouldSign) {
  const args = ["commit"];
  if (shouldSign) {
    args.push("-S");
  }

  args.push("-m", message);
  command("git", args, { stdio: "inherit" });
  return output("git", ["rev-parse", "HEAD"]);
}

export function pushCurrentBranch(branch, force) {
  const args = ["push"];
  if (force) {
    args.push("--force-with-lease");
  }

  args.push("origin", `HEAD:refs/heads/${branch}`);
  command("git", args, { stdio: "inherit" });
}
export function hasStagedChanges() {
  return (
    command("git", ["diff", "--cached", "--quiet"], {
      allowFailure: true,
    }).status !== 0
  );
}

export function commitChanges(message, sign, noVerify) {
  const args = ["commit"];
  if (sign) {
    args.push("-S");
  }
  if (noVerify) {
    args.push("--no-verify");
  }
  args.push("-m", message);

  command("git", args, { stdio: "inherit" });
}

export function pushBranch(branch) {
  command("git", ["push", "--force-with-lease", "origin", branch], {
    stdio: "inherit",
  });
}

export function remoteBranchExists(branch) {
  return (
    command("git", ["ls-remote", "--exit-code", "--heads", "origin", branch], {
      allowFailure: true,
    }).status === 0
  );
}

export function deleteRemoteBranch(branch) {
  command("git", ["push", "origin", "--delete", branch], {
    allowFailure: true,
    stdio: "inherit",
  });
}

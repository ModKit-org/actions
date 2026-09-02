import { command, output } from "./command.mjs";
import { fail } from "./workflow.mjs";

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
  } else {
    command("git", ["add", "--", ...paths]);
  }
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

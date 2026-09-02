import { mkdirSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { command } from "../../git/src/command.mjs";
import { fail, input, notice } from "../../git/src/workflow.mjs";

const targets = {
  "linux-x64": "x86_64-unknown-linux-gnu",
  "linux-arm64": "aarch64-unknown-linux-gnu",
  "darwin-x64": "x86_64-apple-darwin",
  "darwin-arm64": "aarch64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
};

function resolveTarget() {
  const key = `${process.platform}-${process.arch}`;
  const target = targets[key];
  if (!target) {
    fail(`Unsupported platform/arch combination for git-cliff: ${key}`);
  }
  return target;
}

function findBinary(dir) {
  const binaryName = process.platform === "win32" ? "git-cliff.exe" : "git-cliff";
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      const found = findBinary(entryPath);
      if (found) {
        return found;
      }
    } else if (entry === binaryName) {
      return entryPath;
    }
  }
  return null;
}

export async function installGitCliff() {
  const version = input("git-cliff-version").trim() || "2.14.1";
  const target = resolveTarget();
  const extension = process.platform === "win32" ? "zip" : "tar.gz";
  const assetName = `git-cliff-${version}-${target}.${extension}`;
  const url = `https://github.com/orhun/git-cliff/releases/download/v${version}/${assetName}`;

  const response = await fetch(url);
  if (!response.ok) {
    fail(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const workDir = mkdtempSync(join(tmpdir(), "git-cliff-"));
  const archivePath = join(workDir, assetName);
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));

  const extractDir = join(workDir, "extracted");
  mkdirSync(extractDir, { recursive: true });
  command("tar", ["-xf", archivePath, "-C", extractDir]);

  const binaryPath = findBinary(extractDir);
  if (!binaryPath) {
    fail(`Could not find the git-cliff binary inside ${assetName}.`);
  }

  const installDir = join(process.env.RUNNER_TEMP ?? tmpdir(), "git-cliff-bin");
  mkdirSync(installDir, { recursive: true });
  const targetName = process.platform === "win32" ? "git-cliff.exe" : "git-cliff";
  const installedPath = join(installDir, targetName);
  command("cp", [binaryPath, installedPath]);
  if (process.platform !== "win32") {
    await chmod(installedPath, 0o755);
  }

  // Make the binary available to command()/output() calls for the rest of this process.
  process.env.PATH = `${installDir}${delimiter}${process.env.PATH}`;
  notice(`Installed git-cliff v${version} to ${installedPath}.`);
}

import { spawnSync } from "node:child_process";

import { fail } from "./workflow.mjs";

export function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    shell: false,
    stdio: options.stdio ?? "pipe",
  });

  if (result.error) {
    fail(`Unable to run ${commandName}: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || "").trim();
    fail(detail || `${commandName} exited with code ${result.status}.`);
  }
  return result;
}

export function output(commandName, args, options = {}) {
  return command(commandName, args, {
    ...options,
    stdio: "pipe",
  }).stdout.trim();
}

export function binaryOutput(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: null,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    fail(`Unable to run ${commandName}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      (result.stderr?.toString("utf8") || "").trim() ||
        `${commandName} exited with code ${result.status}.`,
    );
  }
  return result.stdout;
}

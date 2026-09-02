import { appendFileSync } from "node:fs";

export function input(name) {
  return process.env[`INPUT_${name.replaceAll("-", "_").toUpperCase()}`] ?? "";
}

export function notice(message) {
  console.log(`::notice::${message}`);
}

export function fail(message) {
  throw new Error(message);
}

export function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${name}=${String(value)}\n`,
      "utf8",
    );
  }
}

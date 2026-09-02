import { appendFileSync, readFileSync } from "node:fs";

export function eventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return {};
  }
  return JSON.parse(readFileSync(eventPath, "utf8"));
}

export function input(name) {
  return process.env[`INPUT_${name.replaceAll(" ", "_").toUpperCase()}`] ?? "";
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

// Shared entry point wrapper so every script surfaces failures the same way.
export async function run(main) {
  try {
    await main();
  } catch (error) {
    console.log(`::error::${error.message}`);
    process.exitCode = 1;
  }
}

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { command, output } from "../../git/src/command.mjs";
import { fail, input } from "../../git/src/workflow.mjs";

const signingTempDirectory = mkdtempSync(join(tmpdir(), "modkit-commit-"));

export function validateSigningInputs(method) {
  if (!["none", "github", "gpg", "ssh"].includes(method)) {
    fail("Input 'signing-method' must be one of: none, github, gpg, ssh.");
  }

  if (method === "gpg" && !input("gpg-private-key").trim()) {
    fail("Input 'gpg-private-key' is required when signing-method is 'gpg'.");
  }

  if (method === "ssh" && !input("ssh-signing-key").trim()) {
    fail("Input 'ssh-signing-key' is required when signing-method is 'ssh'.");
  }
}

export function configureSigning(method) {
  if (method === "gpg") {
    return configureGpg();
  }

  if (method === "ssh") {
    configureSsh();
  }

  return {};
}

function configureGpg() {
  const gpgHome = join(signingTempDirectory, "gnupg");
  const pinentryPath = join(signingTempDirectory, "pinentry.mjs");
  mkdirSync(gpgHome, { mode: 0o700 });
  const pinentrySource = [
    "#!/usr/bin/env node",
    String.raw`const passphrase = (process.env["INPUT_GPG-PASSPHRASE"] ?? "").replaceAll("%", "%25").replaceAll("\n", "").replaceAll("\r", "");`,
    'let buffer = "";',
    String.raw`process.stdout.write("OK ModKit pinentry ready\n");`,
    'process.stdin.setEncoding("utf8");',
    'process.stdin.on("data", chunk => {',
    "  buffer += chunk;",
    String.raw`  const lines = buffer.split("\n");`,
    "  buffer = lines.pop();",
    "  for (const line of lines) {",
    '    if (line === "GETPIN") process.stdout.write(`D ${passphrase}\\nOK\\n`);',
    '    if (line === "BYE") process.exit(0);',
    "  }",
    "});",
    "",
  ].join("\n");
  writeFileSync(pinentryPath, pinentrySource, { mode: 0o700 });
  writeFileSync(
    join(gpgHome, "gpg-agent.conf"),
    `allow-loopback-pinentry\npinentry-program ${pinentryPath}\n`,
    { mode: 0o600 },
  );

  const gpgEnvironment = { GNUPGHOME: gpgHome };
  const privateKeyPath = join(signingTempDirectory, "gpg-private-key.asc");
  writeFileSync(privateKeyPath, input("gpg-private-key"), { mode: 0o600 });
  command("gpg", ["--batch", "--import", privateKeyPath], {
    env: gpgEnvironment,
  });

  const fingerprint = output(
    "gpg",
    ["--batch", "--with-colons", "--list-secret-keys"],
    { env: gpgEnvironment },
  )
    .split("\n")
    .find((line) => line.startsWith("fpr:"))
    ?.split(":")[9];
  if (!fingerprint) {
    fail("No secret GPG signing key was imported.");
  }

  command("gpgconf", ["--launch", "gpg-agent"], { env: gpgEnvironment });
  command("git", ["config", "--local", "gpg.format", "openpgp"]);
  command("git", ["config", "--local", "user.signingkey", fingerprint]);
  return gpgEnvironment;
}

function configureSsh() {
  const privateKeyPath = join(signingTempDirectory, "ssh-signing-key");
  const publicKeyPath = `${privateKeyPath}.pub`;
  writeFileSync(privateKeyPath, `${input("ssh-signing-key").trim()}\n`, {
    mode: 0o600,
  });
  command("ssh-keygen", ["-y", "-f", privateKeyPath]);
  const publicKey = output("ssh-keygen", ["-y", "-f", privateKeyPath]);
  writeFileSync(publicKeyPath, `${publicKey}\n`, { mode: 0o600 });
  command("git", ["config", "--local", "gpg.format", "ssh"]);
  command("git", ["config", "--local", "user.signingkey", publicKeyPath]);
}

export function cleanupSigningMaterial() {
  if (existsSync(signingTempDirectory)) {
    rmSync(signingTempDirectory, { recursive: true, force: true });
  }
}

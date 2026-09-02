# Commit Action

Stages changes in the current checkout, creates one commit, and pushes the current branch. The
caller owns branch checkout and lifecycle; this action never creates, switches, or resets a branch.
By default it never force-pushes either; set `force-push: true` when the caller recreates/rewrites
the branch on every run.

## Usage

The workflow needs an existing checkout with credentials that can push to its current branch.

```yaml
permissions:
  contents: write

steps:
  - uses: actions/checkout@v6
    with:
      ref: ${{ github.ref_name }}
      persist-credentials: true

  # ... change files ...

  - name: Commit changes
    id: commit
    uses: ModKit-org/actions/commit@v1
    with:
      commit-message: "chore: update generated files"
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

When the caller recreates the branch from its base on every run (e.g. an "automated update" PR
branch), set `force-push: true` so the rewritten history can still be pushed:

```yaml
- uses: ModKit-org/actions/commit@v1
  with:
    commit-message: "chore: automated update"
    force-push: "true"
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

By default, all working-tree changes are staged with `git add -A`. To stage only selected paths:

```yaml
- uses: ModKit-org/actions/commit@v1
  with:
    commit-message: "docs: update API reference"
    paths: |
      docs/api.md
      docs/sidebar.yml
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### GitHub-managed signing

GitHub's Contents API creates commits that GitHub reports as verified. Because that API creates one
commit for each file mutation, this mode deliberately accepts **exactly one staged file**. Use GPG
or SSH signing when one signed commit must include several files.

```yaml
- uses: ModKit-org/actions/commit@v1
  with:
    commit-message: "chore: update generated manifest"
    paths: generated/manifest.json
    signing-method: github
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### GPG signing

Store the private key and passphrase in GitHub Actions secrets. Register the corresponding public
GPG key with the GitHub account that should verify the commit.

```yaml
- uses: ModKit-org/actions/commit@v1
  with:
    commit-message: "chore: publish generated files"
    signing-method: gpg
    gpg-private-key: ${{ secrets.COMMIT_GPG_PRIVATE_KEY }}
    gpg-passphrase: ${{ secrets.COMMIT_GPG_PASSPHRASE }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### SSH signing

Store an unencrypted SSH private signing key in Actions secrets, then register its public key with
the GitHub account as a **signing key**. It is distinct from an SSH authentication key.

```yaml
- uses: ModKit-org/actions/commit@v1
  with:
    commit-message: "chore: publish generated files"
    signing-method: ssh
    ssh-signing-key: ${{ secrets.COMMIT_SSH_SIGNING_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input             | Required | Default                                        | Description                                                                                                                          |
| ----------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `commit-message`  | Yes      |                                                | Commit message.                                                                                                                      |
| `github-token`    | Yes      |                                                | Token for GitHub-managed signing. Requires `contents: write`; configure checkout with credentials that can push for Git-based modes. |
| `paths`           | No       | `-A`                                           | Paths to stage. Accepts a space- or newline-separated list.                                                                          |
| `signing-method`  | No       | `none`                                         | One of `none`, `github`, `gpg`, or `ssh`.                                                                                            |
| `git-user-name`   | No       | `github-actions[bot]`                          | Author name for normal, GPG, and SSH commits.                                                                                        |
| `git-user-email`  | No       | `github-actions[bot]@users.noreply.github.com` | Author email for normal, GPG, and SSH commits.                                                                                       |
| `gpg-private-key` | GPG only |                                                | ASCII-armored private signing key. Use an Actions secret.                                                                            |
| `gpg-passphrase`  | No       |                                                | Passphrase for the GPG private key. Use an Actions secret.                                                                           |
| `ssh-signing-key` | SSH only |                                                | Unencrypted private SSH signing key. Use an Actions secret.                                                                          |
| `force-push`      | No       | `false`                                        | Force-push (with lease) instead of a plain push. Ignored when `signing-method` is `github`.                                          |

## Outputs

| Output       | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| `committed`  | `true` when the action created a commit, otherwise `false`. |
| `commit-sha` | SHA of the new commit; empty when there were no changes.    |
| `pushed`     | `true` when the new commit was pushed; otherwise `false`.   |

## Implementation

This is a direct `node24` action. GitHub Actions automatically exposes each declared input to
`src/main.mjs` as an environment variable named `INPUT_<INPUT_NAME>`, with hyphens converted to
underscores and letters uppercased. For example, `signing-method` becomes
`INPUT_SIGNING_METHOD`. Callers provide values only through `with`; they do not configure these
environment variables themselves.

The action publishes its declared outputs by appending to the runner-provided `GITHUB_OUTPUT` file.

## Signing methods

| Method   | Signature source                | Multi-file commit        | GitHub verification                                    |
| -------- | ------------------------------- | ------------------------ | ------------------------------------------------------ |
| `none`   | None                            | Yes                      | No                                                     |
| `github` | GitHub Contents API             | No, one staged file only | Checked by the action after creation                   |
| `gpg`    | Caller-provided GPG private key | Yes                      | Requires the matching public key on the GitHub account |
| `ssh`    | Caller-provided SSH private key | Yes                      | Requires the public key as a GitHub signing key        |

## Behavior

1. Validates its inputs and requires a non-detached checked-out branch.
2. Configures the selected Git author identity and stages the requested paths.
3. Exits successfully with `committed=false` if the staged index is empty.
4. Creates and pushes one commit using the selected signing method. Normal, GPG, and SSH methods use
   `git push origin HEAD:refs/heads/<current-branch>` and never force push.
5. Removes temporary GPG and SSH private-key material before the action exits.

## Requirements

- A preceding `actions/checkout` step with credentials that can push to the checked-out branch.
- `permissions: contents: write` for the supplied token.
- GitHub-hosted runners provide Node.js, Git, GitHub CLI, GnuPG, and OpenSSH. Self-hosted runners
  need those tools available on `PATH` for the signing methods they use.

## License

The scripts and documentation in this project are released under the [MIT License](../LICENSE).

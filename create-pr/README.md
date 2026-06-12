# Create or update Pull Request Action

This action automates the "create-a-PR-from-a-workflow" pattern: it stages the changes that earlier
steps produced, commits them on a dedicated branch, pushes the branch, and either opens a new pull
request or updates the existing one for that branch.

> [!NOTE]  
> This is a thin, opinionated wrapper around `git`, `git push`, and the GitHub CLI
> (`gh pr create` / `gh pr edit`). It does **not** perform any code modifications itself — earlier
> steps in the workflow are expected to leave the working tree dirty before this action runs.

## Usage

See [create-pr/action.yml](./action.yml).

### Bump a dependency version

```yaml
name: Update dependencies

on:
  workflow_dispatch:
  schedule:
    - cron: "0 6 * * 1"

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      # ... steps that update files in the working tree ...

      - id: pr
        uses: ModKit-org/actions/create-pr@v1
        with:
          branch: automated/update-package
          commit-message: "chore(deps): update @npm/package to ${{ steps.get-version.outputs.version }}"
          pr-body: |
            ## Automated Dependency Update

            This PR updates `@npm/package` to version **${{ steps.get-version.outputs.version }}**.

            **Workflow run:** ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          labels: |
            dependencies
            automated
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Resetting the branch each run

When the workflow regenerates artifacts from scratch every run, set `reset-branch: true` so the
branch is rewound to the base before staging the new changes. This keeps the PR's diff focused on
the latest run only.

```yaml
- uses: ModKit-org/actions/create-pr@v1
  with:
    branch: docs/v${{ steps.version.outputs.version }}
    base-branch: ${{ github.ref_name }}
    commit-message: "chore(docs): update generated docs to ${{ steps.version.outputs.version }}"
    pr-body: |
      Updates generated documentation in `docs/api.md` from
      `${{ steps.current.outputs.version }}` to `${{ steps.version.outputs.version }}`.

      When merged, this will trigger documentation deployment.
    paths: docs/api.md
    reset-branch: true
    labels: documentation,automated
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Clean up the branch on failure

There are two scopes of "failure" to consider:

1. **A failure inside this action** (for example `gh pr create` rejects the request after the
   branch has already been force-pushed). Set `delete-branch-on-failure: true` to have the action
   tear the pushed branch down on its way out — but only when no open PR exists for it.

   ```yaml
   - uses: ModKit-org/actions/create-pr@v1
     with:
       branch: automated/update-package
       commit-message: "chore(deps): update @npm/package"
       delete-branch-on-failure: true
       github-token: ${{ secrets.GITHUB_TOKEN }}
   ```

2. **A failure in a later step in the calling job** (tests, linters, downstream deploys, …). A
   composite action cannot observe those, so the caller has to handle it. Add a small follow-up
   step that removes the remote branch when the job fails and no PR exists for it yet:

   ```yaml
   - name: Clean up branch on failure
     if: failure()
     env:
       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       BRANCH_NAME: automated/update-package
     run: |
       EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --state open --json number --jq '.[0].number')
       if [ -z "$EXISTING_PR" ] && git ls-remote --heads origin "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
         git push origin --delete "$BRANCH_NAME"
       fi
   ```

## How it works

1. **Validate inputs** — ensures `branch` and `base-branch` are present and distinct.
2. **Configure git identity** — sets `user.name` / `user.email` (defaults to `github-actions[bot]`).
3. **Prepare branch and commit changes**:
   - Fetches `base-branch` and `branch` from `origin`.
   - When `reset-branch: true`, recreates the branch from `origin/<base-branch>`. Otherwise reuses
     the current working tree on a (re)created `branch`.
   - Stages the configured `paths` (defaults to `-A`).
   - Exits early when there is nothing to commit and `skip-if-no-changes` is `true`
     (the default). Otherwise, commits with the provided message and force-pushes the branch using
     `--force-with-lease`.
4. **Create or update the pull request**:
   - If an open PR already exists for `branch`, the action updates its title, body, and labels via
     `gh pr edit --add-label` (existing labels are preserved).
   - Otherwise it opens a new PR against `base-branch` with the supplied title, body, and labels.
   - Writes a small summary block to `$GITHUB_STEP_SUMMARY` linking to the PR.

## Required permissions

The calling workflow must grant the following permissions:

```yaml
permissions:
  contents: write # push the branch
  pull-requests: write # create and update the PR
```

## Requirements

- A prior `actions/checkout` step. The default `fetch-depth: 1` is sufficient unless your workflow
  relies on additional history.
- The `gh` CLI, which is preinstalled on GitHub-hosted runners.
- The provided `github-token` must be allowed to push branches and open pull requests in the
  repository (the default `GITHUB_TOKEN` works for branches in the same repository).

## License

The scripts and documentation in this project are released under the [MIT License](../LICENSE).

---

<div align="center">
  <sub>Built by ModKit</sub>
</div>

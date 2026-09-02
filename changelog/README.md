# Changelog Action

This action generates changelogs with [git-cliff](https://git-cliff.org/) and integrates them into your
pull-request and release flow. It runs in one of two modes:

- **Preview mode**:  
  Posts (or updates) a comment on a pull request with the unreleased changelog, so reviewers see
  exactly what the next release notes will look like.
- **Release mode**:  
  Prepends the new section to `CHANGELOG.md`, commits it to a `changelog/<tag>` branch, and opens a
  pull request. When that PR is merged, a separate release workflow can create the tag and GitHub release.

The mode is auto-detected from the triggering event (`pull_request` → preview, `workflow_dispatch` → release), but can
also be forced explicitly.

> [!NOTE]  
> This action expects a git-cliff configuration file in the repository (default: `.github/cliff.toml`) and
> a checkout with full history (`fetch-depth: 0`) so git-cliff can read the commit log.

## Usage

See [changelog/action.yml](./action.yml)

**Default, auto-detected mode**:

```yaml
name: Generate Changelog

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]
  workflow_dispatch:
    inputs:
      tag_name:
        description: "Version tag to release (e.g. v5.1.0)"
        required: true
        type: string
      prerelease:
        description: "Mark as pre-release"
        required: false
        default: false
        type: boolean

permissions:
  contents: write
  pull-requests: write

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: ModKit-org/actions/changelog@v1
        with:
          tag-name: ${{ inputs.tag_name }}
          prerelease: ${{ inputs.prerelease }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Preview only (PR comment)**:

```yaml
steps:
  - uses: actions/checkout@v6
    with:
      fetch-depth: 0
  - uses: ModKit-org/actions/changelog@v1
    with:
      mode: preview
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Release only (open changelog PR)**:

```yaml
steps:
  - uses: actions/checkout@v6
    with:
      fetch-depth: 0
  - uses: ModKit-org/actions/changelog@v1
    with:
      mode: release
      tag-name: v5.1.0
      prerelease: false
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

## How it works

### Preview mode

1. Installs the `git-cliff` CLI (downloaded directly from its GitHub releases) and runs
   `git-cliff --unreleased --strip header` to build a snippet of the unreleased changes.
2. Reads the generated file and falls back to `_No unreleased changes detected._` when empty.
3. Posts the snippet as a comment on the current pull request, or updates the existing comment identified by the
   marker `<!-- git-cliff-preview -->`.

### Release mode

1. Verifies that the requested tag does not already exist.
2. Runs `git-cliff --tag <tag-name> --unreleased --prepend <changelog-file>` to add the new section at the top of the
   changelog while preserving any manual edits below.
3. Commits the change on a new branch `changelog/<tag-name>` as `github-actions[bot]` and pushes it.
4. Opens a pull request titled `chore(release): update <changelog-file> for <tag-name>` with the configured label.
   The body indicates that the tag/release will be created automatically after the PR is merged, and flags pre-releases
   when applicable.

If no changelog diff is produced in release mode, the step fails with a diagnostic message suggesting likely causes
(no unreleased commits, commits filtered by `cliff.toml`, or non-conventional commit messages).

## Inputs

| Input            | Required | Default              | Description                                                                                                                 |
| ---------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `mode`           | no       | _auto-detect_        | `preview` or `release`. When empty, `pull_request` events become `preview` and `workflow_dispatch` events become `release`. |
| `tag-name`       | no¹      |                      | Version tag to release (e.g. `v5.1.0`). **Required when `mode` is `release`.**                                              |
| `prerelease`     | no       | `false`              | Marks the upcoming release as a pre-release. Only used in release mode (surfaced in the PR body).                           |
| `config`         | no       | `.github/cliff.toml` | Path to the git-cliff configuration file.                                                                                   |
| `git-cliff-version` | no   | `2.14.1`             | `git-cliff` release version to install (without the leading `v`).                                                           |
| `changelog-file` | no       | `CHANGELOG.md`       | Path to the changelog file to prepend to in release mode.                                                                   |
| `pr-label`       | no       | `automated`          | Label applied to the release PR.                                                                                            |
| `github-token`   | **yes**  |                      | Token used to post PR comments, push the changelog branch, and open the PR. Typically `${{ secrets.GITHUB_TOKEN }}`.        |

¹ Required when `mode` resolves to `release`.

## Outputs

This action does not expose outputs.

## Required permissions

The calling workflow must grant the following permissions (composite actions cannot declare them themselves):

```yaml
permissions:
  contents: write # push the changelog branch
  pull-requests: write # create/update PR comments and open the release PR
```

## Requirements

- A `git-cliff` configuration file in the repository (default location: `.github/cliff.toml`).
- `actions/checkout` must run with `fetch-depth: 0` so the full commit history is available.
- For release mode, the repository must allow `github-actions[bot]` to push branches and open pull requests.

## License

The scripts and documentation in this project are released under the [MIT License](../LICENSE)

---

<div align="center">
  <sub>Built by ModKit</sub>
</div>

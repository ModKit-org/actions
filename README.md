# ModKit Actions

A collection of reusable GitHub composite actions for .NET and related workflows.

## Overview

This repository provides a set of composite GitHub Actions for .NET projects and
related technologies.

- **[changelog](changelog/README.md)**: Composite action for generating changelogs using git-cliff, supporting both PR comment previews and release branch creation with a pull request. The action can be triggered in preview mode on pull requests to show the unreleased changelog, or in release mode to create a new section in `CHANGELOG.md` and open a pull request for it.
- **[create-pr](create-pr/README.md)**: Composite action that commits the current working-tree changes to a dedicated
  branch, force-pushes it, and creates or updates a pull request via the GitHub CLI. Designed for the recurring
  "automated update" pattern (dependency bumps, regenerated docs, synced assets, etc.).
- **[commit](commit/README.md)**: Composite action that stages changes, commits and pushes the current branch, with
  optional GitHub-managed, GPG, or SSH commit signing.

More actions will be added over time to support a variety of CI/CD scenarios.

## Usage

Each composite action is located in its own subdirectory. See the README in each action's folder for detailed usage
instructions and input/output documentation.

### See READMEs for individual actions

- [changelog README.md](changelog/README.md) for an example of how to use the `changelog` action in both preview and release modes.
- [create-pr README.md](create-pr/README.md) for examples of opening or updating a pull request from a workflow that produces working-tree changes.
- [commit README.md](commit/README.md) for examples of committing and pushing changes with optional signing.

## License

This repository is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built by ModKit</sub>
</div>

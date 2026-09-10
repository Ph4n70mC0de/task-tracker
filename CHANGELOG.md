# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-10

### Added
- `task-cli help` and command-specific `--help` output.
- `task-cli show <id>` to display a single task.
- `task-cli done <id>`, `task-cli start <id>`, `task-cli reopen <id>` commands.
- Backward-compatible aliases `mark-done` and `mark-in-progress`.
- `--json` flag for machine-readable output on `list` and `show`.
- `--no-color` flag to disable ANSI color output.
- `--yes` flag to bypass confirmation prompts on destructive actions.
- Confirmation prompt before `delete` to prevent accidental data loss.
- Colored status indicators in default human-readable output.
- Improved empty-state messages and command help text.
- GitHub Actions CI running Node.js 18, 20, and 22 LTS.
- Baseline regression tests and fixed nested test registration bug in `cli.test.js`.

### Changed
- `list` output format now includes colored status by default.
- CLI argument parsing extracts global flags before command dispatch.
- Task timestamps remain in UTC ISO-8601 format.

### Fixed
- Nested test registration in `tests/cli.test.js` that prevented the `unknown ID` test from executing.

## [1.0.0] - 2026-09-08

### Added
- Initial release: `add`, `update`, `delete`, `mark-in-progress`, `mark-done`, `list`.
- JSON persistence with atomic temp-file rename.
- Task model: `id`, `description`, `status`, `createdAt`, `updatedAt`.
- Statuses: `todo`, `in-progress`, `done`.
- Built-in Node.js test runner with unit and integration tests.
- `TASK_TRACKER_FILE` environment variable for test isolation.

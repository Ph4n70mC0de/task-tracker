# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-10

### Added
- `task-cli search <query>` for full-text search across title, description, project, and tags.
- `task-cli due today|overdue|week` for time-based task views.
- `task-cli stats` for task counts (total, todo, in-progress, done, overdue, today, this week).
- `list` command supports `--status`, `--priority`, `--project`, `--tag`, `--sort`, and `--query` flags.
- Deterministic sorting by id, created, updated, due, priority, and status.
- Domain tests for multi-criteria filtering, sorting, search, overdue/today/week detection, and statistics.
- CLI integration tests for search, due queries, stats, and multi-flag list filtering.

### Changed
- `list` positional filter still works for backward compatibility.
- Sort defaults to ID when no `--sort` flag is provided.

## [1.2.0] - 2026-09-10

### Added
- Schema version 2 with new task fields: `title`, `priority`, `project`, `tags`, `dueAt`, `completedAt`.
- Automatic migration from v1 to v2 on load; old `tasks.json` files are upgraded in place with safe defaults.
- `--priority` flag on `add` and `update` (values: `low`, `medium`, `high`, `urgent`).
- `--due <ISO-8601 date>` flag on `add` and `update`.
- `--project <name>` flag on `add` and `update`.
- `--tags <tag1,tag2>` flag on `add` and `update`.
- `done` command now records `completedAt` timestamp.
- `reopen` command clears `completedAt`.
- Validation for priority values, ISO-8601 due dates, and tag arrays.
- Colored priority indicators in human-readable output.
- Storage tests for migration, validation of new fields, and idempotent load of v2 data.
- Domain tests for optional fields, partial updates, and `completedAt` behavior.

### Changed
- `update` command accepts optional description argument when only flags are provided.
- `saveTasks` writes `__version: 2` into every persisted task record.
- `loadTasks` migrates v1 records to v2 and rewrites the file only when migration occurs.

### Fixed
- Validation now accepts both v1 and v2 task records during migration.

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

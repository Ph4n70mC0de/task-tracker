# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-09-10

### Added

- `archive <id>` — archive a task so it is hidden from default `list` output.
- `restore <id>` — unarchive a previously archived task.
- `list --archived` — show only archived tasks (default `list` excludes archived).
- `backup` — create a timestamped backup of the current `tasks.json` in the same directory.
- `recover <file>` — replace the current store with the contents of a backup file (requires `--yes` or interactive confirmation).
- `export <file>` — export all tasks to a JSON file with schema version and export timestamp.
- `import <file>` — import tasks from a JSON file or an object with a `tasks` array; duplicates (by ID) are skipped and a summary is printed.
- `archived` field on every task record (schema v2); migrated automatically on first load.
- `show` output now includes an `archived` indicator when a task is archived.
- Configuration module (`src/config.js`) with precedence: CLI flags > environment variables > config file (`task-tracker.json` or `.task-tracker.json` in cwd or `~/.task-tracker/`) > defaults.
- Environment variables: `TASK_TRACKER_FILE`, `TASK_TRACKER_COLOR`, `TASK_TRACKER_DATE_FORMAT`, `TASK_TRACKER_DEFAULT_PROJECT`.
- `configFilePaths()` and `loadConfigFile()` exported for testing and future tooling.
- `storageDir()` and `storageBaseName()` on the storage module.
- Domain functions `archiveTask`, `restoreTask`, `isArchived`, `getArchivedTasks` on `src/tasks.js`.
- Storage functions `backupTasks`, `recoverTasks`, `exportTasks`, `importTasks` on `src/storage.js`.
- 48 new tests covering archive/restore, backup/recover, export/import, and configuration (total: 133 passing).

### Changed

- `list` no longer requires a positional status filter; all filter flags are now optional.
- `createTask` sets `archived: false` on all newly created tasks.
- `filterTasks` excludes archived tasks by default; pass `archived: true` to include only archived.
- `importTasks` now returns accurate `imported` and `skipped` counts (previously reported total incoming as imported).
- `importTasks` merges new tasks by ID, skipping duplicates instead of overwriting existing records.

### Fixed

- `due today` now uses local date comparison consistently with `isToday` (UTC date strings caused timezone-dependent misses).

## [1.1.0] — 2026-09-08

### Added

- Schema version 2 with automatic migration from version 1.
- Task fields: `title`, `priority`, `project`, `tags`, `dueAt`, `completedAt`.
- Commands: `done`, `start`, `reopen`, `search`, `due`, `stats`.
- Aliases: `mark-done` → `done`, `mark-in-progress` → `start`.
- `--json` output mode for `list`, `show`, and `stats`.
- `--no-color` flag.
- `--yes` flag to skip destructive-action confirmation.
- Multi-criteria list filtering (`--status`, `--priority`, `--project`, `--tag`).
- Deterministic sorting (`--sort id|created|updated|due|priority|status`).
- Atomic file writes with temp-file rename and cleanup on failure.
- Schema validation on load: rejects malformed JSON, empty files, non-array top-level, invalid records, duplicate IDs.

# Task Tracker CLI

A zero-dependency Node.js command-line task tracker. Tasks are stored in a local `tasks.json` file using atomic writes so interrupted runs never leave corrupt data behind.

## Install

```bash
npm install
```

No third-party dependencies. Requires Node.js >= 18.

## Commands

```bash
task-cli add <description>           Add a new task
task-cli show <id>                   Show a single task
task-cli update <id> <description>   Update task description
task-cli delete <id>                 Delete a task
task-cli done <id>                   Mark task as done
task-cli start <id>                  Mark task as in-progress
task-cli reopen <id>                 Reopen a completed task
task-cli list [filter]               List tasks (filter: todo|in-progress|done)
task-cli help                        Show help
```

Aliases: `mark-done <id>` → `done <id>`, `mark-in-progress <id>` → `start <id>`.

## Global Flags

```bash
task-cli --json <command>            Machine-readable JSON output
task-cli --no-color <command>        Disable ANSI color
task-cli --yes <command>             Skip destructive-action confirmation
task-cli --help                      Show help
```

## Output

Default output is human-readable with colored status indicators. Use `--json` for scripts and automation:

```bash
task-cli list --json
task-cli show --json 1
```

## Storage

Tasks are stored in `tasks.json` in the current working directory. Set `TASK_TRACKER_FILE` to use a different path:

```bash
TASK_TRACKER_FILE=/tmp/tasks.json task-cli add "Write docs"
```

## Task Model

Each task record:

```json
{
  "id": 1,
  "description": "Buy groceries",
  "status": "todo",
  "createdAt": "2026-09-08T10:00:00.000Z",
  "updatedAt": "2026-09-08T10:00:00.000Z"
}
```

Valid statuses: `todo`, `in-progress`, `done`.

## Scripting

Exit codes are standard: `0` on success, `1` on error. All user-facing errors are printed to stderr as `Error: <message>`.

```bash
task-cli add "Deploy release"
task-cli start 1
task-cli done 1
```

## Development

```bash
npm test
```

Tests use the built-in Node.js test runner. CI runs on Node.js 18, 20, and 22.

## License

MIT

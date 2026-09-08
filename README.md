# Task Tracker CLI

A small, zero-dependency command-line to-do tracker. Tasks are stored in a
single JSON file (`tasks.json`) in the current directory. Built entirely with
the Node.js standard library — no frameworks, databases, or third-party packages.

## Requirements

- Node.js 18 or newer (developed and tested on Node 24). No `npm install` step is needed.

## Setup

```bash
git clone <repository-url>
cd task-tracker
```

That's it. Run the CLI with:

```bash
node bin/task-cli.js <command> [arguments]
```

Optionally install a global `task-cli` shim with `npm link`, or use `npm start -- <command>`.

## Usage

```bash
task-cli add "Buy groceries"
task-cli update 1 "Buy groceries and cook dinner"
task-cli delete 1
task-cli mark-in-progress 1
task-cli mark-done 1
task-cli list
task-cli list done        # only completed tasks
task-cli list todo        # only tasks still to do
task-cli list in-progress # only active tasks
```

## Example session

```bash
$ node bin/task-cli.js add "Buy groceries"
Task added successfully (ID: 1)

$ node bin/task-cli.js add "Study for exam"
Task added successfully (ID: 2)

$ node bin/task-cli.js mark-in-progress 2
Task marked as in-progress (ID: 2)

$ node bin/task-cli.js list
ID: 1 | todo | Buy groceries
Created: 2026-09-08T21:30:00.000Z
Updated: 2026-09-08T21:30:00.000Z

ID: 2 | in-progress | Study for exam
Created: 2026-09-08T21:30:05.000Z
Updated: 2026-09-08T21:30:20.000Z

$ node bin/task-cli.js mark-done 1
Task marked as done (ID: 1)

$ node bin/task-cli.js list done
ID: 1 | done | Buy groceries
...

$ node bin/task-cli.js delete 1
Task deleted successfully (ID: 1)
```

## Data storage

- `tasks.json` is created automatically (containing `[]`) in the **current working
  directory** the first time the CLI runs.
- The file is read before every operation and rewritten after every successful
  mutation, so data persists between runs.
- The file is plain JSON (pretty-printed, 2-space indent) and is safe to inspect by hand.

### Task schema

```json
{
  "id": 1,
  "description": "Buy groceries",
  "status": "todo",
  "createdAt": "2026-09-08T21:30:00.000Z",
  "updatedAt": "2026-09-08T21:30:00.000Z"
}
```

| Field | Rule |
|---|---|
| `id` | Unique positive integer; new tasks get highest existing ID + 1 |
| `description` | Non-empty, trimmed string |
| `status` | `todo`, `in-progress`, or `done` |
| `createdAt` | Set once at creation, never changed |
| `updatedAt` | Set at creation and refreshed on every modification |

## Error handling

All errors are printed as `Error: <message>` on stderr and exit with code `1`
(success exits with `0`). Failed operations never write the data file.

Common failures:

- **Unknown command / no command / wrong number of arguments** — prints usage.
- **Invalid task ID** (e.g. `abc`, `0`, `-1`) — rejected during parsing.
- **Task ID not found** — `Error: Task with ID 999 was not found.`
- **Empty or whitespace-only description** — rejected for `add` and `update`.
- **Invalid list filter** — only `todo`, `in-progress`, `done` are accepted.
- **Missing, empty, or malformed `tasks.json`** — reported clearly; the file is
  **never** silently replaced, so you can fix or restore it.

## Testing

```bash
npm test
```

Runs the built-in Node.js test runner (`node --test`) over the `tests/` directory.
The suite covers adding/listing/filtering/updating/marking/deleting, ID assignment,
missing and invalid arguments, unknown IDs, empty descriptions, invalid filters,
automatic file creation, malformed-file recovery, persistence between runs, and
the timestamp invariants (`createdAt` stable, `updatedAt` refreshed). Tests use
temporary directories via the `TASK_TRACKER_FILE` environment variable, so they
never touch your real `tasks.json`.

## Project structure

```text
task-tracker/
├── bin/task-cli.js      # executable entry point
├── src/
│   ├── cli.js           # argument parsing, command dispatch, exit codes
│   ├── tasks.js         # business rules (create/update/delete/status/list)
│   ├── storage.js       # load/save of tasks.json (only file access)
│   ├── validation.js    # input and data validation, error types
│   └── output.js        # human-readable presentation
├── tests/               # node:test suites (storage, tasks, end-to-end CLI)
├── README.md
└── package.json
```

## Limitations

Intentionally excluded to keep the project focused: databases, remote sync,
authentication, concurrency control (two simultaneous writers could race),
per-user data, due dates, priorities, and any third-party CLI framework.

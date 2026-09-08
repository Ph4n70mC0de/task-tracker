# Task Tracker CLI — Project Roadmap

## 1. Project Goal

Create a lightweight command-line application for managing personal tasks. The program will store its data in a local JSON file and expose a small set of terminal commands for adding, editing, deleting, status management, and filtered listing.

The project is intentionally focused on fundamentals: command-line argument handling, file I/O, JSON serialization, data validation, timestamps, error handling, and testing. No database, web server, external package, or framework is required.

## 2. Final Feature Set

The completed CLI should support:

| Command | Purpose |
|---|---|
| `task-cli add "description"` | Create a new task |
| `task-cli update <id> "description"` | Change a task description |
| `task-cli delete <id>` | Remove a task |
| `task-cli mark-in-progress <id>` | Set status to `in-progress` |
| `task-cli mark-done <id>` | Set status to `done` |
| `task-cli list` | Show all tasks |
| `task-cli list done` | Show completed tasks |
| `task-cli list todo` | Show tasks that are still todo |
| `task-cli list in-progress` | Show active tasks |

Task statuses are limited to:

- `todo`
- `in-progress`
- `done`

## 3. Task Data Model

Each task should contain exactly the core fields required by the specification:

```json
{
  "id": 1,
  "description": "Buy groceries",
  "status": "todo",
  "createdAt": "2026-09-08T15:30:00Z",
  "updatedAt": "2026-09-08T15:30:00Z"
}
```

### Field rules

| Field | Rule |
|---|---|
| `id` | Unique positive integer |
| `description` | Non-empty, trimmed string |
| `status` | `todo`, `in-progress`, or `done` |
| `createdAt` | Set once when the task is created |
| `updatedAt` | Set on creation and refreshed on every modification |

Use an unambiguous timestamp format. ISO 8601 is recommended because it is human-readable and sortable.

## 4. Storage Design

Use one JSON file in the current working directory:

```text
tasks.json
```

A simple top-level array is enough:

```json
[
  {
    "id": 1,
    "description": "Buy groceries",
    "status": "todo",
    "createdAt": "2026-09-08T15:30:00Z",
    "updatedAt": "2026-09-08T15:30:00Z"
  }
]
```

The application must:

1. Check whether `tasks.json` exists.
2. Create it automatically when it does not exist.
3. Read the current contents before an operation that needs task data.
4. Parse and validate the JSON.
5. Apply the requested change in memory.
6. Write the updated collection back to the same file.

Do not introduce a database or substitute a custom storage system.

## 5. Recommended Project Structure

A small structure is preferable to a large framework-style layout:

```text
task-tracker/
├── src/
│   ├── cli
│   ├── storage
│   ├── tasks
│   └── main
├── tests/
├── tasks.json
├── README.md
├── .gitignore
└── package/project metadata
```

The exact filenames depend on the language. The important separation is conceptual:

### CLI layer
Responsible for reading positional arguments, choosing the command, and displaying results or errors.

### Task/service layer
Responsible for business rules such as creating IDs, changing statuses, updating descriptions, and finding tasks.

### Storage layer
Responsible only for loading and saving JSON data and handling file-related failures.

Avoid building an elaborate architecture for a project this size.

## 6. Phase 1 — Environment and Repository Setup

### Objectives

Prepare a clean development environment and establish version control before implementing features.

### Tasks

- Choose the implementation language.
- Create the project directory.
- Initialize Git.
- Add a `.gitignore`.
- Create the source and test directories.
- Decide the application entry point.
- Confirm the program can run from the terminal.
- Confirm the native filesystem and JSON APIs required by the language are available.

### Completion criteria

You can run the application entry point successfully, even if it only prints a temporary message.

---

## 7. Phase 2 — Command Parsing

### Objectives

Build the CLI shell before implementing task behavior.

### Tasks

Define the command forms:

```text
task-cli <command> [arguments]
```

Recognize:

```text
add
update
delete
mark-in-progress
mark-done
list
```

For `list`, optionally accept one filter:

```text
done
todo
in-progress
```

### Validation rules

Reject:

- no command
- unknown command
- missing required arguments
- extra arguments where they are not allowed
- invalid numeric task IDs
- unsupported list filters

Return a clear usage or error message instead of failing with a raw runtime exception.

### Completion criteria

Every command is recognized and invalid command lines fail predictably.

---

## 8. Phase 3 — JSON Storage

### Objectives

Implement persistence before adding business operations.

### Tasks

Create reusable storage functions conceptually equivalent to:

```text
loadTasks()
saveTasks(tasks)
ensureStorageFile()
```

### Required behavior

When the file does not exist:

```text
[]
```

should be created automatically.

When the file exists but is empty or malformed, report a meaningful error. Do not silently replace user data with an empty list unless the implementation explicitly documents a safe recovery strategy.

### Completion criteria

Tasks can be loaded from and saved to `tasks.json` without using external libraries.

---

## 9. Phase 4 — Add Task

### Command

```bash
task-cli add "Buy groceries"
```

### Behavior

1. Validate the description.
2. Load existing tasks.
3. Determine a new unique ID.
4. Create the timestamps.
5. Set status to `todo`.
6. Append the task.
7. Save the collection.
8. Print the new task ID.

Example:

```text
Task added successfully (ID: 1)
```

### ID strategy

A simple implementation can use:

```text
highest existing ID + 1
```

When there are no tasks, start at `1`.

Do not reuse an existing ID while another task still has it.

### Edge cases

- Empty description
- Whitespace-only description
- Missing description
- Corrupt storage file

---

## 10. Phase 5 — List Tasks

### Command

```bash
task-cli list
```

### Filtered commands

```bash
task-cli list done
task-cli list todo
task-cli list in-progress
```

### Behavior

- Load tasks.
- Apply the optional status filter.
- Sort by ID for predictable output.
- Print each task in a readable format.
- Print a useful message when there are no matching tasks.

A simple output format is sufficient:

```text
ID: 1 | todo | Buy groceries
Created: 2026-09-08T15:30:00Z
Updated: 2026-09-08T15:30:00Z
```

Exact presentation is flexible, but it should be consistent across commands.

### Completion criteria

All tasks appear in the unfiltered view, and each supported filter returns only matching tasks.

---

## 11. Phase 6 — Update Task

### Command

```bash
task-cli update 1 "Buy groceries and cook dinner"
```

### Behavior

1. Validate the ID.
2. Load tasks.
3. Find the matching task.
4. Validate the replacement description.
5. Update `description`.
6. Refresh `updatedAt`.
7. Preserve `id`, `status`, and `createdAt`.
8. Save the result.

The command must not accidentally reset a task's status to `todo`.

### Edge cases

- Nonexistent ID
- Non-numeric ID
- Missing description
- Empty description

---

## 12. Phase 7 — Delete Task

### Command

```bash
task-cli delete 1
```

### Behavior

1. Validate the ID.
2. Load tasks.
3. Locate the task.
4. Remove it.
5. Save the remaining tasks.
6. Confirm deletion.

Example:

```text
Task deleted successfully (ID: 1)
```

### Edge cases

Attempting to delete an ID that does not exist should return a clear error and leave the JSON file unchanged.

---

## 13. Phase 8 — Status Management

### Commands

```bash
task-cli mark-in-progress 1
task-cli mark-done 1
```

### Behavior

Both commands:

1. Validate the ID.
2. Load tasks.
3. Find the task.
4. Change only the status.
5. Refresh `updatedAt`.
6. Save the result.
7. Print a confirmation.

The status must be exactly one of:

```text
todo
in-progress
done
```

No other status should be written by the application.

### Design consideration

It is useful to implement one internal status-update function and have both commands call it rather than duplicating logic.

---

## 14. Phase 9 — Error Handling

The application should fail gracefully and explain what went wrong.

### Errors to handle

#### CLI errors
- Unknown command
- Missing argument
- Too many arguments
- Invalid task ID
- Invalid list filter

#### Data errors
- File read failure
- Invalid JSON
- Unexpected JSON structure
- Invalid task fields
- Duplicate task IDs

#### Operation errors
- Task does not exist
- Empty description

### User-facing error style

Prefer messages such as:

```text
Error: Task with ID 7 was not found.
```

instead of exposing a raw stack trace during normal CLI use.

For script-friendly behavior, return a non-zero process exit code for failed commands.

---

## 15. Phase 10 — Testing Strategy

Testing should focus on behavior rather than implementation details.

### Core tests

| Test | Expected result |
|---|---|
| Add first task | ID `1`, status `todo` |
| Add second task | Unique next ID |
| List all | All stored tasks shown |
| List `done` | Only done tasks shown |
| List `todo` | Only todo tasks shown |
| List `in-progress` | Only in-progress tasks shown |
| Update task | Description changes and `updatedAt` changes |
| Mark in progress | Status becomes `in-progress` |
| Mark done | Status becomes `done` |
| Delete task | Task disappears |
| Unknown ID | Clear error, no data corruption |
| Invalid ID | Clear validation error |
| Empty description | Rejected |
| Missing file | File created automatically |
| Invalid filter | Rejected |
| No tasks | Clean empty-state message |

### Timestamp test

A particularly important test is:

```text
createdAt before update == createdAt after update
updatedAt before update != updatedAt after update
```

When the test runs very quickly, make sure the implementation or test setup can reliably distinguish timestamp changes without weakening the actual behavior.

### Persistence test

Run the application, add a task, terminate it, start it again, and verify the task is still present. This confirms the project is actually file-backed rather than storing tasks only in memory.

---

## 16. Phase 11 — Manual CLI Verification

After automated tests pass, perform a complete terminal walkthrough:

```bash
task-cli add "Buy groceries"
task-cli add "Study for exam"
task-cli list

task-cli mark-in-progress 2
task-cli list in-progress

task-cli mark-done 1
task-cli list done

task-cli update 2 "Study for programming exam"
task-cli list

task-cli delete 1
task-cli list
```

Then deliberately try invalid operations:

```bash
task-cli update 999 "Missing task"
task-cli delete abc
task-cli list invalid
task-cli add ""
```

Confirm that errors are clear and `tasks.json` remains valid.

---

## 17. Phase 12 — README and Documentation

The README should be written for someone seeing the repository for the first time.

Include:

### Project overview
What the CLI does and why the project exists.

### Requirements
Language/runtime version and any standard tooling required.

### Installation or setup
Exact commands needed to run the project.

### Usage
Show every supported command.

### Examples
Include a short end-to-end terminal session.

### Data storage
Explain that `tasks.json` is created in the current directory and contains the task records.

### Task schema
Document the five required fields and valid statuses.

### Error handling
Explain the most common validation failures.

### Testing
Provide the command used to run the test suite.

### Limitations
State intentionally excluded features such as databases, remote synchronization, authentication, or external integrations.

---

## 18. Phase 13 — Code Quality Pass

Before considering the project complete, review the implementation manually.

Check that:

- There is no unnecessary dependency.
- File access is centralized.
- JSON parsing and writing are handled safely.
- Task validation is not duplicated unnecessarily.
- Status values are constrained.
- IDs remain unique.
- `createdAt` is never changed by an update.
- `updatedAt` changes for every mutation.
- User input is trimmed and validated.
- Errors are understandable.
- Commands return appropriate exit codes.
- The source remains small enough for a beginner to study.
- Comments explain reasoning rather than narrating obvious code.

---

# Suggested Milestone Order

Build in this order so each stage produces something testable:

```text
1. Repository setup
2. CLI argument parsing
3. JSON file creation/loading/saving
4. Add task
5. List tasks
6. Update task
7. Delete task
8. Mark in-progress
9. Mark done
10. Filtering
11. Error handling hardening
12. Automated tests
13. README
14. Final refactor and manual verification
```

Do not start by building every command at once. Finish one behavior, test it, then move to the next.

# Definition of Done

The project is complete when all of the following are true:

- The application runs entirely from the command line.
- Commands use positional arguments.
- `tasks.json` is used as the persistent data store.
- The file is automatically created when missing.
- No external libraries or frameworks are required.
- Add, update, delete, status changes, and listing work correctly.
- All three statuses are supported.
- Task IDs are unique.
- Required timestamps are stored correctly.
- Invalid inputs are handled without corrupting data.
- Automated tests cover the main behaviors and important edge cases.
- The README allows another developer to set up and use the project without guesswork.
- The final code is readable, focused, and easy to extend.

# Expert Review Checklist

Use this checklist to judge an implementation rather than relying only on whether the happy-path demo works.

## Functional correctness

- Does every required command exist?
- Do the commands produce the expected state changes?
- Are list filters exact?
- Are task IDs unique and stable?

## Persistence

- Does the application really read/write the JSON file?
- Is the file created automatically?
- Does data survive a program restart?
- Does a failed operation avoid partially writing invalid data?

## Data integrity

- Are all five required properties present?
- Is `createdAt` immutable after creation?
- Is `updatedAt` refreshed for every mutation?
- Are invalid statuses impossible through normal commands?

## CLI quality

- Are positional arguments handled correctly?
- Are missing and extra arguments rejected?
- Are errors clear?
- Is a failed command represented by a non-zero exit code?

## Robustness

- What happens when the task list is empty?
- What happens when an ID does not exist?
- What happens when the JSON file is malformed?
- What happens when the description is blank?
- What happens when the user enters an unsupported filter?

## Code quality

- Does the code use only the standard library?
- Is persistence logic separated from task logic?
- Is duplicated logic minimized?
- Is the code easy for another developer to understand?

## Testing quality

- Are tests repeatable?
- Do they cover both success and failure cases?
- Do they verify persisted data rather than only in-memory values?
- Do timestamp invariants get tested?

# Suggested Final Repository

```text
task-tracker/
├── src/
│   ├── ...
├── tests/
│   ├── ...
├── tasks.json
├── README.md
├── .gitignore
└── ...
```

The exact names are language-specific; the behavior and constraints are the important part.

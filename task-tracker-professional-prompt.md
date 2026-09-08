# Task Tracker CLI — Professional Project Prompt

Build a small command-line task tracker that lets a user manage a personal to-do list directly from the terminal. The application should accept commands and positional arguments, keep task data in a JSON file located in the current working directory, and provide a simple, predictable interface for creating, editing, deleting, updating, and filtering tasks.

Use any programming language with a standard/native filesystem API, but do not use external libraries, frameworks, databases, or third-party CLI packages. The JSON file must be created automatically when it does not exist. Keep the implementation intentionally small and readable so the project demonstrates core programming skills rather than hiding the important logic behind dependencies.

The CLI must support these operations: add a task, update an existing task, delete a task, mark a task as in progress, mark a task as done, list all tasks, and list tasks filtered by `done`, `todo`, or `in-progress`. User-supplied values should be passed through positional command-line arguments. Every task must contain a unique numeric `id`, a `description`, a `status`, a `createdAt` timestamp, and an `updatedAt` timestamp. New tasks start with the `todo` status. The creation timestamp must remain unchanged for the lifetime of the task, while the update timestamp must change whenever the task is modified.

Use a single JSON file, such as `tasks.json`, in the current directory. Store the tasks in a straightforward structure that is easy to inspect manually. The program should read the file before modifying data, validate the requested operation, write the updated data back to disk, and handle a missing file by creating an empty task collection. Avoid silently overwriting malformed data: invalid JSON, invalid task records, unknown commands, missing arguments, invalid task IDs, and unsupported status values should produce clear error messages and a non-zero process exit code where appropriate.

The command interface should follow this general shape:

```bash
task-cli add "Buy groceries"
task-cli update 1 "Buy groceries and cook dinner"
task-cli delete 1
task-cli mark-in-progress 1
task-cli mark-done 1
task-cli list
task-cli list done
task-cli list todo
task-cli list in-progress
```

Expected behavior includes assigning the next available unique ID when adding a task, preserving task history fields correctly, preventing operations on nonexistent task IDs, rejecting empty descriptions, and refusing invalid list filters. Listing should be human-readable and deterministic; sorting by numeric task ID is a reasonable default. The implementation should also behave correctly when there are no tasks.

Organize the source code so command parsing, validation, task operations, persistence, and presentation are separated enough to remain understandable without introducing unnecessary architecture. Keep comments focused on decisions or non-obvious logic rather than restating the code. Include a README that explains prerequisites, setup, commands, JSON storage behavior, examples, error handling, and how to run the test suite.

Testing should cover normal operations as well as edge cases. At minimum, verify adding the first and subsequent tasks, listing all tasks, filtering by each supported status, updating descriptions, marking status changes, deleting tasks, handling an unknown ID, handling a missing argument, rejecting an invalid status/filter, rejecting an empty description, creating the JSON file automatically, and recovering safely from the absence of an existing data file. Tests should also confirm that `createdAt` remains stable after an update while `updatedAt` changes.

The finished project should be easy for another developer to clone, run, inspect, and extend. Favor explicit logic, standard-library functionality, clear terminal output, and reliable error handling over clever abstractions.

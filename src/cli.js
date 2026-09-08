'use strict';

const { CliError, ValidationError, parseTaskId, parseStatusFilter, STATUSES } = require('./validation');
const { createTask, updateTask, deleteTask, setTaskStatus, listTasks } = require('./tasks');
const { formatTaskList } = require('./output');
const storage = require('./storage');

const USAGE = `Usage:
  task-cli add <description>
  task-cli update <id> <description>
  task-cli delete <id>
  task-cli mark-in-progress <id>
  task-cli mark-done <id>
  task-cli list [done|todo|in-progress]`;

// Arity table: [minimum, maximum] positional arguments per command.
// Extra arguments are rejected rather than silently ignored.
const COMMAND_ARGS = {
  add: [1, 1],
  update: [2, 2],
  delete: [1, 1],
  'mark-in-progress': [1, 1],
  'mark-done': [1, 1],
  list: [0, 1],
};

function checkArity(command, args) {
  const [min, max] = COMMAND_ARGS[command];
  if (args.length < min || args.length > max) {
    const expected = min === max ? `${min}` : `${min}-${max}`;
    throw new CliError(
      `Wrong number of arguments for "${command}" (expected ${expected}, got ${args.length}).\n${USAGE}`
    );
  }
}

/**
 * Execute one CLI invocation. Returns the process exit code.
 * All errors are reported as "Error: <message>" via io.error, never a stack trace.
 * io (log/error) is injectable so tests can capture output.
 */
function runCommand(argv, io = console, storageModule = storage) {
  const command = argv[0];
  const args = argv.slice(1);

  try {
    if (!command) {
      throw new CliError(`No command given.\n${USAGE}`);
    }
    if (!(command in COMMAND_ARGS)) {
      throw new CliError(`Unknown command "${command}".\n${USAGE}`);
    }
    checkArity(command, args);

    switch (command) {
      case 'add': {
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated, task } = createTask(tasks, args[0], now);
        storageModule.saveTasks(updated);
        io.log(`Task added successfully (ID: ${task.id})`);
        return 0;
      }
      case 'update': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = updateTask(tasks, id, args[1], now);
        storageModule.saveTasks(updated);
        io.log(`Task updated successfully (ID: ${id})`);
        return 0;
      }
      case 'delete': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const { tasks: updated } = deleteTask(tasks, id);
        storageModule.saveTasks(updated);
        io.log(`Task deleted successfully (ID: ${id})`);
        return 0;
      }
      case 'mark-in-progress':
      case 'mark-done': {
        const id = parseTaskId(args[0]);
        const status = command === 'mark-done' ? 'done' : 'in-progress';
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = setTaskStatus(tasks, id, status, now);
        storageModule.saveTasks(updated);
        io.log(`Task marked as ${status} (ID: ${id})`);
        return 0;
      }
      case 'list': {
        const filter = args.length === 1 ? parseStatusFilter(args[0]) : null;
        const tasks = listTasks(storageModule.loadTasks(), filter);
        io.log(formatTaskList(tasks));
        return 0;
      }
      // Unreachable: every command in COMMAND_ARGS has a case above.
    }
  } catch (err) {
    if (err instanceof CliError || err instanceof ValidationError) {
      io.error(`Error: ${err.message}`);
      return 1;
    }
    // Unexpected failures (e.g. filesystem errors) still get a clean message
    // for CLI users; the stack trace is kept for debugging.
    io.error(`Error: ${err.message}`);
    if (process.env.NODE_ENV !== 'production') {
      io.error(err.stack);
    }
    return 1;
  }
}

function main() {
  process.exit(runCommand(process.argv.slice(2)));
}

module.exports = { runCommand, main, USAGE, STATUSES };

if (require.main === module) {
  main();
}

'use strict';

const fs = require('node:fs');
const { CliError, ValidationError, parseTaskId, parseStatusFilter, STATUSES, resolveCommandStatus } = require('./validation');
const { createTask, updateTask, deleteTask, setTaskStatus, listTasks } = require('./tasks');
const { formatTaskList, formatTask, formatTaskListJson, formatTaskJson, setForceColor } = require('./output');
const storage = require('./storage');

const USAGE = `Usage:
  task-cli [--json] [--no-color] [--yes] <command> [args...]
  task-cli help [<command>]

Commands:
  add <description>           Add a new task
  show <id>                   Show task details
  update <id> <description>   Update task description
  delete <id>                 Delete a task
  done <id>                   Mark task as done
  start <id>                  Mark task as in-progress
  reopen <id>                 Reopen a completed task
  list [filter]               List tasks (filter: todo|in-progress|done)
  help [<command>]            Show this help

Aliases:
  mark-done <id>              Same as: done <id>
  mark-in-progress <id>       Same as: start <id>`;

const COMMAND_ARGS = {
  add: [1, 1],
  show: [1, 1],
  update: [2, 2],
  delete: [1, 1],
  done: [1, 1],
  start: [1, 1],
  reopen: [1, 1],
  'mark-done': [1, 1],
  'mark-in-progress': [1, 1],
  list: [0, 1],
  help: [0, 1],
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

function parseFlags(argv) {
  const flags = {
    json: argv.includes('--json'),
    noColor: argv.includes('--no-color'),
    yes: argv.includes('--yes'),
    help: argv.includes('--help'),
  };
  const remaining = argv.filter((arg) => !arg.startsWith('--'));
  return { flags, remaining };
}

function confirmDelete(io, confirm) {
  if (!confirm) return true;
  const answer = confirm('Delete this task? (y/N) ');
  if (!answer) {
    io.log('Deletion cancelled.');
  }
  return answer;
}

function runCommand(argv, io = console, storageModule = storage, confirm = null) {
  const { flags, remaining } = parseFlags(argv);

  if (flags.noColor) {
    setForceColor(false);
  }

  if (flags.help) {
    io.log(USAGE);
    return 0;
  }

  const command = remaining[0];
  const args = remaining.slice(1);

  try {
    if (!command) {
      throw new CliError(`No command given.\n${USAGE}`);
    }
    if (!(command in COMMAND_ARGS)) {
      throw new CliError(`Unknown command "${command}".\n${USAGE}`);
    }
    checkArity(command, args);

    const outputJson = flags.json;

    switch (command) {
      case 'help': {
        io.log(USAGE);
        return 0;
      }
      case 'add': {
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated, task } = createTask(tasks, args[0], now);
        storageModule.saveTasks(updated);
        io.log(`Task added successfully (ID: ${task.id})`);
        return 0;
      }
      case 'show': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const task = tasks.find((t) => t.id === id);
        if (!task) {
          throw new ValidationError(`Task with ID ${id} was not found.`);
        }
        if (outputJson) {
          io.log(formatTaskJson(task));
        } else {
          io.log(formatTask(task));
        }
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
        if (!flags.yes && !confirmDelete(io, confirm)) {
          return 0;
        }
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const { tasks: updated } = deleteTask(tasks, id);
        storageModule.saveTasks(updated);
        io.log(`Task deleted successfully (ID: ${id})`);
        return 0;
      }
      case 'done':
      case 'mark-done': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = setTaskStatus(tasks, id, 'done', now);
        storageModule.saveTasks(updated);
        io.log(`Task marked as done (ID: ${id})`);
        return 0;
      }
      case 'start':
      case 'mark-in-progress': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = setTaskStatus(tasks, id, 'in-progress', now);
        storageModule.saveTasks(updated);
        io.log(`Task marked as in-progress (ID: ${id})`);
        return 0;
      }
      case 'reopen': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = setTaskStatus(tasks, id, 'todo', now);
        storageModule.saveTasks(updated);
        io.log(`Task reopened (ID: ${id})`);
        return 0;
      }
      case 'list': {
        const filter = args.length === 1 ? parseStatusFilter(args[0]) : null;
        const tasks = listTasks(storageModule.loadTasks(), filter);
        if (outputJson) {
          io.log(formatTaskListJson(tasks));
        } else {
          io.log(formatTaskList(tasks));
        }
        return 0;
      }
      // Unreachable: every command in COMMAND_ARGS has a case above.
    }
  } catch (err) {
    if (err instanceof CliError || err instanceof ValidationError) {
      io.error(`Error: ${err.message}`);
      return 1;
    }
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

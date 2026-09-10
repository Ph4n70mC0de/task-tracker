'use strict';

const fs = require('node:fs');
const { CliError, ValidationError, parseTaskId, parseStatusFilter, STATUSES, resolveCommandStatus, parsePriority, parseDueDate, parseTags } = require('./validation');
const { createTask, updateTask, deleteTask, setTaskStatus, listTasks, searchTasks, getOverdueTasks, getTodayTasks, getWeekTasks, getStats, archiveTask, restoreTask, getArchivedTasks } = require('./tasks');
const { formatTaskList, formatTask, formatTaskListJson, formatTaskJson, setForceColor } = require('./output');
const storage = require('./storage');

const USAGE = `Usage:
  task-cli [--json] [--no-color] [--yes] <command> [args...]
  task-cli help [<command>]

Commands:
  add <description>                      Add a new task
  show <id>                              Show task details
  update <id> [description]               Update task
  delete <id>                            Delete a task
  done <id>                              Mark task as done
  start <id>                             Mark task as in-progress
  reopen <id>                            Reopen a completed task
  archive <id>                           Archive a task
  restore <id>                           Restore an archived task
  backup                                 Create a timestamped backup
  recover <file>                         Restore from a backup file
  export <file>                          Export tasks to a JSON file
  import <file>                          Import tasks from a JSON file
  list [filter]                          List tasks (filter: todo|in-progress|done)
  search <query>                         Full-text search in tasks
  due <today|overdue|week>               Show tasks due today, overdue, or this week
  stats                                  Show task statistics
  help [<command>]                       Show this help

Aliases:
  mark-done <id>                         Same as: done <id>
  mark-in-progress <id>                  Same as: start <id>`;

const COMMAND_ARGS = {
  add: [1, 1],
  show: [1, 1],
  update: [1, 2],
  delete: [1, 1],
  done: [1, 1],
  start: [1, 1],
  reopen: [1, 1],
  'mark-done': [1, 1],
  'mark-in-progress': [1, 1],
  archive: [1, 1],
  restore: [1, 1],
  backup: [0, 0],
  recover: [1, 1],
  export: [1, 1],
  'import': [1, 1],
  list: [0, 1],
  search: [1, 1],
  due: [1, 1],
  stats: [0, 0],
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
    json: false,
    noColor: false,
    yes: false,
    help: false,
  };
  const values = {};
  const remaining = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--json') {
      flags.json = true;
      i++;
    } else if (arg === '--no-color') {
      flags.noColor = true;
      i++;
    } else if (arg === '--yes') {
      flags.yes = true;
      i++;
    } else if (arg === '--help') {
      flags.help = true;
      i++;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        values[key] = argv[i + 1];
        i += 2;
      } else {
        values[key] = true;
        i++;
      }
    } else {
      remaining.push(arg);
      i++;
    }
  }

  return { flags, values, remaining };
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
  const { flags, values, remaining } = parseFlags(argv);

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
        const options = {
          title: values.title,
          priority: values.priority ? parsePriority(values.priority) : undefined,
          dueAt: values.due ? parseDueDate(values.due) : undefined,
          project: values.project,
          tags: values.tags ? parseTags(values.tags) : undefined,
        };
        const { tasks: updated, task } = createTask(tasks, args[0], options, now);
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
        const options = {
          title: values.title,
          priority: values.priority ? parsePriority(values.priority) : undefined,
          dueAt: values.due ? parseDueDate(values.due) : undefined,
          project: values.project,
          tags: values.tags ? parseTags(values.tags) : undefined,
        };
        const description = args[1];
        const { tasks: updated } = updateTask(tasks, id, description, options, now);
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
      case 'archive': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = archiveTask(tasks, id, now);
        storageModule.saveTasks(updated);
        io.log(`Task archived (ID: ${id})`);
        return 0;
      }
      case 'restore': {
        const id = parseTaskId(args[0]);
        const tasks = storageModule.loadTasks();
        const now = new Date().toISOString();
        const { tasks: updated } = restoreTask(tasks, id, now);
        storageModule.saveTasks(updated);
        io.log(`Task restored (ID: ${id})`);
        return 0;
      }
      case 'backup': {
        const backupPath = storageModule.backupTasks();
        io.log(`Backup created: ${backupPath}`);
        return 0;
      }
      case 'recover': {
        if (!flags.yes && !confirmDelete(io, confirm)) {
          return 0;
        }
        const recovered = storageModule.recoverTasks(args[0]);
        io.log(`Recovered ${recovered.length} tasks from backup.`);
        return 0;
      }
      case 'export': {
        const exportPath = storageModule.exportTasks(args[0]);
        io.log(`Tasks exported to: ${exportPath}`);
        return 0;
      }
      case 'import': {
        if (!flags.yes && !confirmDelete(io, confirm)) {
          return 0;
        }
        const result = storageModule.importTasks(args[0]);
        io.log(`Imported ${result.imported} tasks (${result.skipped} duplicates skipped). Total: ${result.total}.`);
        return 0;
      }
      case 'list': {
        const positionalFilter = args.length === 1 ? args[0] : null;
        const filter = {
          status: values.status ? parseStatusFilter(values.status) : (positionalFilter ? parseStatusFilter(positionalFilter) : null),
          priority: values.priority ? parsePriority(values.priority) : null,
          project: values.project || null,
          tag: values.tag || null,
          query: values.query || null,
        };
        if (values.archived) {
          filter.archived = true;
        }
        const sortBy = values.sort || 'id';
        const tasks = listTasks(storageModule.loadTasks(), filter, sortBy);
        if (outputJson) {
          io.log(formatTaskListJson(tasks));
        } else {
          io.log(formatTaskList(tasks));
        }
        return 0;
      }
      case 'search': {
        const tasks = searchTasks(storageModule.loadTasks(), args[0]);
        if (outputJson) {
          io.log(formatTaskListJson(tasks));
        } else {
          io.log(formatTaskList(tasks));
        }
        return 0;
      }
      case 'due': {
        const allTasks = storageModule.loadTasks();
        let tasks;
        if (args[0] === 'today') {
          tasks = getTodayTasks(allTasks);
        } else if (args[0] === 'overdue') {
          tasks = getOverdueTasks(allTasks);
        } else if (args[0] === 'week') {
          tasks = getWeekTasks(allTasks);
        } else {
          throw new CliError(`Unknown due filter "${args[0]}". Supported: today, overdue, week.\n${USAGE}`);
        }
        if (outputJson) {
          io.log(formatTaskListJson(tasks));
        } else {
          io.log(formatTaskList(tasks));
        }
        return 0;
      }
      case 'stats': {
        const stats = getStats(storageModule.loadTasks());
        if (outputJson) {
          io.log(JSON.stringify(stats, null, 2));
        } else {
          io.log(`Total: ${stats.total}`);
          io.log(`Todo: ${stats.todo}`);
          io.log(`In Progress: ${stats.inProgress}`);
          io.log(`Done: ${stats.done}`);
          io.log(`Overdue: ${stats.overdue}`);
          io.log(`Due Today: ${stats.today}`);
          io.log(`Due This Week: ${stats.thisWeek}`);
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

'use strict';

// End-to-end CLI tests: each runCommand call behaves like one process run,
// with all state coming from (and going back to) the JSON file.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCommand } = require('../src/cli');
const storage = require('../src/storage');

let tmpDir;
let file;
let io;

function cli(...args) {
  const out = [];
  const err = [];
  const code = runCommand(args, { log: (m) => out.push(m), error: (m) => err.push(m) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function loadJson() {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-tracker-cli-'));
  file = path.join(tmpDir, 'tasks.json');
  process.env.TASK_TRACKER_FILE = file;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.TASK_TRACKER_FILE;
});

test('add: first and second task, IDs assigned and persisted', () => {
  const first = cli('add', 'Buy groceries');
  assert.equal(first.code, 0);
  assert.match(first.out, /Task added successfully \(ID: 1\)/);
  assert.equal(fs.existsSync(file), true); // file auto-created

  const second = cli('add', 'Study for exam');
  assert.match(second.out, /ID: 2\)/);
  const tasks = loadJson();
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks.map((t) => t.id), [1, 2]);
  assert.equal(tasks[0].status, 'todo');
  assert.ok(tasks[0].createdAt && tasks[0].updatedAt);
});

test('list: shows all tasks, then each filter', () => {
  cli('add', 'Buy groceries');
  cli('add', 'Study for exam');
  cli('mark-in-progress', '2');
  cli('add', 'Done task');
  cli('mark-done', '3');

  const all = cli('list');
  assert.equal(all.code, 0);
  assert.match(all.out, /ID: 1 \| todo \| Buy groceries/);
  assert.match(all.out, /ID: 2 \| in-progress \| Study for exam/);
  assert.match(all.out, /ID: 3 \| done \| Done task/);
  assert.match(all.out, /Created: /);
  assert.match(all.out, /Updated: /);

  const todo = cli('list', 'todo');
  assert.match(todo.out, /ID: 1/);
  assert.doesNotMatch(todo.out, /ID: 2/);

  const inProgress = cli('list', 'in-progress');
  assert.match(inProgress.out, /ID: 2 \| in-progress \| Study for exam/);
  assert.doesNotMatch(inProgress.out, /ID: 1/);

  const done = cli('list', 'done');
  assert.match(done.out, /ID: 3 \| done \| Done task/);
  assert.doesNotMatch(done.out, /ID: 1/);
});

test('update: persists new description and refreshes updatedAt while keeping createdAt', () => {
  cli('add', 'Buy groceries');
  const before = loadJson()[0];

  // Rewrite the file with a known old timestamp so the change is unambiguous
  // even when the test runs within the same millisecond.
  const older = { ...before, updatedAt: '2020-01-01T00:00:00.000Z' };
  fs.writeFileSync(file, JSON.stringify([older]));
  const result = cli('update', '1', 'Buy groceries and cook dinner');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task updated successfully \(ID: 1\)/);

  const after = loadJson()[0];
  assert.equal(after.description, 'Buy groceries and cook dinner');
  assert.equal(after.createdAt, before.createdAt);
  assert.notEqual(after.updatedAt, before.updatedAt);
  assert.equal(after.createdAt, older.createdAt);
});

test('unknown ID: clear error, non-zero exit, file unchanged', () => {
  cli('add', 'Buy groceries');
  const before = fs.readFileSync(file, 'utf8');
  for (const args of [
    ['update', '999', 'Missing task'],
    ['delete', '999'],
    ['mark-in-progress', '999'],
    ['mark-done', '999'],
  ]) {
    const result = cli(...args);
    assert.equal(result.code, 1);
    assert.match(result.err, /Error: Task with ID 999 was not found\./);
    assert.equal(fs.readFileSync(file, 'utf8'), before); // no corruption
  }
});

test('invalid task ID: non-numeric and out-of-range values are rejected', () => {
  for (const id of ['abc', '0', '-1', '1.5']) {
    const result = cli('delete', id);
    assert.equal(result.code, 1);
    assert.match(result.err, /not a valid task ID/);
  }
});

test('empty description is rejected for add and update', () => {
  const added = cli('add', '');
  assert.equal(added.code, 1);
  assert.match(added.err, /Error: Description must be a non-empty string\./);

  cli('add', 'Real task');
  const updated = cli('update', '1', '   ');
  assert.equal(updated.code, 1);
  assert.match(updated.err, /Description must be a non-empty string\./);
  assert.equal(loadJson()[0].description, 'Real task');
});

test('missing and extra arguments are rejected with usage info', () => {
  const noDesc = cli('add');
  assert.equal(noDesc.code, 1);
  assert.match(noDesc.err, /Wrong number of arguments for "add"/);

  assert.equal(cli('delete', '1', 'extra').code, 1);
  assert.equal(cli('list', 'todo', 'extra').code, 1);
  assert.match(cli('delete', '1', 'extra').err, /Usage:/);
});

test('unknown command and no command are rejected', () => {
  const unknown = cli('frobnicate');
  assert.equal(unknown.code, 1);
  assert.match(unknown.err, /Unknown command "frobnicate"/);
  assert.match(unknown.err, /Usage:/);

  const none = cli();
  assert.equal(none.code, 1);
  assert.match(none.err, /No command given/);
});

test('invalid list filter is rejected', () => {
  cli('add', 'One');
  const result = cli('list', 'invalid');
  assert.equal(result.code, 1);
  assert.match(result.err, /not a valid list filter/);
});

test('empty listing prints a clean empty-state message', () => {
  const result = cli('list');
  assert.equal(result.code, 0);
  assert.match(result.out, /No tasks found\./);
  const filtered = cli('list', 'done');
  assert.equal(filtered.code, 0);
  assert.match(filtered.out, /No tasks found\./);
});

test('persistence: tasks survive between runs (file-backed, not in-memory)', () => {
  cli('add', 'Buy groceries');
  // Fresh invocation, no shared state: the task must still be there.
  const result = cli('list');
  assert.match(result.out, /Buy groceries/);
  // And a second add continues the ID sequence.
  const second = cli('add', 'Second');
  assert.match(second.out, /ID: 2/);
});

test('malformed storage file produces a clear error and is not overwritten', () => {
  cli('add', 'Real data');
  fs.writeFileSync(file, '{broken');
  const result = cli('list');
  assert.equal(result.code, 1);
  assert.match(result.err, /Error: .*not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken'); // data not silently replaced
});

test('mark-done and mark-in-progress persist status changes', () => {
  cli('add', 'Buy groceries');
  assert.equal(cli('mark-in-progress', '1').out, 'Task marked as in-progress (ID: 1)');
  assert.equal(loadJson()[0].status, 'in-progress');
  assert.equal(cli('mark-done', '1').out, 'Task marked as done (ID: 1)');
  assert.equal(loadJson()[0].status, 'done');
});

test('delete: removes the task and leaves the rest intact', () => {
  cli('add', 'One');
  cli('add', 'Two');
  const result = cli('delete', '1');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task deleted successfully \(ID: 1\)/);
  const tasks = loadJson();
  assert.deepEqual(tasks.map((t) => t.id), [2]);
});

test('show: displays a single task by ID', () => {
  cli('add', 'Buy groceries');
  const result = cli('show', '1');
  assert.equal(result.code, 0);
  assert.match(result.out, /ID: 1/);
  assert.match(result.out, /Buy groceries/);
  assert.match(result.out, /Created: /);
  assert.match(result.out, /Updated: /);
});

test('show: unknown ID returns error', () => {
  cli('add', 'Buy groceries');
  const result = cli('show', '999');
  assert.equal(result.code, 1);
  assert.match(result.err, /Task with ID 999 was not found/);
});

test('done, start, reopen: change status correctly', () => {
  cli('add', 'Buy groceries');
  assert.equal(cli('done', '1').out, 'Task marked as done (ID: 1)');
  assert.equal(loadJson()[0].status, 'done');

  assert.equal(cli('start', '1').out, 'Task marked as in-progress (ID: 1)');
  assert.equal(loadJson()[0].status, 'in-progress');

  assert.equal(cli('reopen', '1').out, 'Task reopened (ID: 1)');
  assert.equal(loadJson()[0].status, 'todo');
});

test('mark-done and mark-in-progress aliases still work', () => {
  cli('add', 'Buy groceries');
  assert.equal(cli('mark-done', '1').out, 'Task marked as done (ID: 1)');
  assert.equal(loadJson()[0].status, 'done');
  assert.equal(cli('mark-in-progress', '1').out, 'Task marked as in-progress (ID: 1)');
  assert.equal(loadJson()[0].status, 'in-progress');
});

test('list --json outputs stable JSON array', () => {
  cli('add', 'Buy groceries');
  cli('add', 'Study for exam');
  const result = cli('list', '--json');
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.out);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, 1);
  assert.equal(parsed[1].id, 2);
});

test('show --json outputs stable JSON object', () => {
  cli('add', 'Buy groceries');
  const result = cli('show', '--json', '1');
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.out);
  assert.equal(parsed.id, 1);
  assert.equal(parsed.description, 'Buy groceries');
});

test('delete --yes bypasses confirmation', () => {
  cli('add', 'Buy groceries');
  const result = cli('--yes', 'delete', '1');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task deleted successfully/);
  assert.equal(loadJson().length, 0);
});

test('delete without --yes asks for confirmation and respects answer', () => {
  cli('add', 'Buy groceries');
  const out = [];
  const err = [];
  const confirm = (msg) => {
    out.push(msg);
    return false;
  };
  const code = runCommand(['delete', '1'], { log: (m) => out.push(m), error: (m) => err.push(m) }, storage, confirm);
  assert.equal(code, 0);
  assert.match(out.join('\n'), /Delete this task/);
  assert.match(out.join('\n'), /Deletion cancelled/);
  assert.equal(loadJson().length, 1);
});

test('help command shows usage', () => {
  const result = cli('help');
  assert.equal(result.code, 0);
  assert.match(result.out, /Usage:/);
  assert.match(result.out, /add <description>/);
  assert.match(result.out, /show <id>/);
  assert.match(result.out, /done <id>/);
});

test('unknown command still rejected', () => {
  const unknown = cli('frobnicate');
  assert.equal(unknown.code, 1);
  assert.match(unknown.err, /Unknown command "frobnicate"/);
});

test('global --help flag shows usage', () => {
  const result = cli('--help');
  assert.equal(result.code, 0);
  assert.match(result.out, /Usage:/);
});

test('--no-color flag is accepted without error', () => {
  cli('add', 'Buy groceries');
  const result = cli('--no-color', 'list');
  assert.equal(result.code, 0);
  assert.match(result.out, /Buy groceries/);
});

test('add: supports --priority --due --project --tags', () => {
  const result = cli('add', 'Buy groceries', '--priority', 'high', '--due', '2026-09-15', '--project', 'Home', '--tags', 'shopping,urgent');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task added successfully/);

  const tasks = loadJson();
  assert.equal(tasks[0].priority, 'high');
  assert.equal(tasks[0].project, 'Home');
  assert.deepEqual(tasks[0].tags, ['shopping', 'urgent']);
  assert.ok(tasks[0].dueAt);
});

test('add: rejects invalid priority', () => {
  const result = cli('add', 'Buy groceries', '--priority', 'critical');
  assert.equal(result.code, 1);
  assert.match(result.err, /not a valid priority/);
});

test('add: rejects invalid due date', () => {
  const result = cli('add', 'Buy groceries', '--due', 'not-a-date');
  assert.equal(result.code, 1);
  assert.match(result.err, /not a valid ISO-8601 date/);
});

test('update: supports --priority --due --project --tags', () => {
  cli('add', 'Buy groceries');
  const result = cli('update', '1', '--priority', 'low', '--project', 'Work', '--tags', 'work');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task updated successfully/);

  const task = loadJson()[0];
  assert.equal(task.priority, 'low');
  assert.equal(task.project, 'Work');
  assert.deepEqual(task.tags, ['work']);
});

test('done: sets completedAt timestamp', () => {
  cli('add', 'Buy groceries');
  const before = loadJson()[0].updatedAt;
  const result = cli('done', '1');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task marked as done/);

  const task = loadJson()[0];
  assert.equal(task.status, 'done');
  assert.ok(task.completedAt);
  assert.notEqual(task.completedAt, before);
});

test('reopen: clears completedAt', () => {
  cli('add', 'Buy groceries');
  cli('done', '1');
  assert.ok(loadJson()[0].completedAt);

  const result = cli('reopen', '1');
  assert.equal(result.code, 0);
  assert.match(result.out, /Task reopened/);

  const task = loadJson()[0];
  assert.equal(task.status, 'todo');
  assert.equal(task.completedAt, null);
});

test('show: displays new fields in human-readable output', () => {
  cli('add', 'Buy groceries', '--priority', 'high', '--project', 'Home', '--tags', 'shopping,urgent', '--due', '2026-09-15');
  const result = cli('show', '1');
  assert.equal(result.code, 0);
  assert.match(result.out, /Priority: high/);
  assert.match(result.out, /Project: Home/);
  assert.match(result.out, /Tags: shopping, urgent/);
  assert.match(result.out, /Due: 2026-09-15/);
});

test('show --json: includes all v2 fields', () => {
  cli('add', 'Buy groceries', '--priority', 'high');
  const result = cli('show', '--json', '1');
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.out);
  assert.equal(parsed.priority, 'high');
  assert.equal(parsed.__version, 2);
  assert.ok('title' in parsed);
  assert.ok('tags' in parsed);
  assert.ok('dueAt' in parsed);
  assert.ok('completedAt' in parsed);
});

test('list --json: includes all v2 fields', () => {
  cli('add', 'Buy groceries', '--priority', 'urgent');
  const result = cli('list', '--json');
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.out);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].priority, 'urgent');
  assert.equal(parsed[0].__version, 2);
});

test('list: supports multiple filter flags', () => {
  cli('add', 'Buy groceries', '--priority', 'high', '--project', 'Home');
  cli('add', 'Write code', '--priority', 'low', '--project', 'Work');
  const result = cli('list', '--priority', 'high', '--project', 'Home');
  assert.equal(result.code, 0);
  assert.match(result.out, /Buy groceries/);
  assert.doesNotMatch(result.out, /Write code/);
});

test('list: supports --sort flag', () => {
  cli('add', 'Buy groceries', '--priority', 'low');
  cli('add', 'Write code', '--priority', 'high');
  const result = cli('list', '--sort', 'priority');
  assert.equal(result.code, 0);
  const lines = result.out.split('\n').filter((l) => l.startsWith('ID:'));
  assert.equal(lines.length, 2);
});

test('search: finds tasks by title', () => {
  cli('add', 'Buy groceries');
  cli('add', 'Write code');
  const result = cli('search', 'groceries');
  assert.equal(result.code, 0);
  assert.match(result.out, /Buy groceries/);
  assert.doesNotMatch(result.out, /Write code/);
});

test('search: finds tasks by tag', () => {
  cli('add', 'Buy groceries', '--tags', 'shopping');
  cli('add', 'Write code', '--tags', 'work');
  const result = cli('search', 'shopping');
  assert.equal(result.code, 0);
  assert.match(result.out, /Buy groceries/);
  assert.doesNotMatch(result.out, /Write code/);
});

test('search: returns empty for no matches', () => {
  cli('add', 'Buy groceries');
  const result = cli('search', 'nonexistent');
  assert.equal(result.code, 0);
  assert.match(result.out, /No tasks found/);
});

test('due today: shows tasks due today', () => {
  const today = new Date().toISOString().slice(0, 10);
  cli('add', 'Buy groceries', '--due', today);
  const result = cli('due', 'today');
  assert.equal(result.code, 0);
  assert.match(result.out, /Buy groceries/);
});

test('due overdue: shows tasks past due', () => {
  cli('add', 'Old task', '--due', '2020-01-01');
  const result = cli('due', 'overdue');
  assert.equal(result.code, 0);
  assert.match(result.out, /Old task/);
});

test('due week: shows tasks due this week', () => {
  const future = new Date();
  future.setDate(future.getDate() + 2);
  const iso = future.toISOString().slice(0, 10);
  cli('add', 'Future task', '--due', iso);
  const result = cli('due', 'week');
  assert.equal(result.code, 0);
  assert.match(result.out, /Future task/);
});

test('stats: shows task counts', () => {
  cli('add', 'Buy groceries');
  cli('add', 'Write code');
  cli('done', '1');
  const result = cli('stats');
  assert.equal(result.code, 0);
  assert.match(result.out, /Total: 2/);
  assert.match(result.out, /Todo: 1/);
  assert.match(result.out, /Done: 1/);
});

test('stats --json: outputs JSON', () => {
  cli('add', 'Buy groceries');
  const result = cli('stats', '--json');
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.out);
  assert.equal(parsed.total, 1);
  assert.equal(parsed.todo, 1);
});

test('unknown due filter is rejected', () => {
  const result = cli('due', 'invalid');
  assert.equal(result.code, 1);
  assert.match(result.err, /Unknown due filter/);
});

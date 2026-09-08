'use strict';

// End-to-end CLI tests: each runCommand call behaves like one process run,
// with all state coming from (and going back to) the JSON file.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCommand } = require('../src/cli');

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

  assert.equal(cli('update', '1').code, 1);
  assert.equal(cli('delete', '1', 'extra').code, 1);
  assert.equal(cli('list', 'todo', 'extra').code, 1);
  assert.match(cli('update', '1').err, /Usage:/);
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

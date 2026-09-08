'use strict';

// Pure business-logic tests: no filesystem involved.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  listTasks,
  nextId,
} = require('../src/tasks');
const { ValidationError } = require('../src/validation');

const T1 = '2026-09-08T10:00:00.000Z';
const T2 = '2026-09-08T11:00:00.000Z';

function makeTasks() {
  const { tasks } = createTask([], 'Buy groceries', T1);
  return createTask(tasks, 'Study for exam', T1).tasks;
}

test('add: first task gets ID 1 and todo status', () => {
  const { tasks, task } = createTask([], 'Buy groceries', T1);
  assert.equal(task.id, 1);
  assert.equal(task.status, 'todo');
  assert.equal(task.description, 'Buy groceries');
  assert.equal(task.createdAt, T1);
  assert.equal(task.updatedAt, T1);
  assert.equal(tasks.length, 1);
});

test('add: subsequent tasks get unique incrementing IDs', () => {
  const { tasks, task } = createTask(makeTasks(), 'Third task', T1);
  assert.equal(task.id, 3);
  assert.equal(nextId(tasks), 4);
  // The max+1 strategy never reuses an ID that is still in use.
  // After deleting the highest ID, that ID becomes available again — allowed
  // because no other task holds it.
  const { tasks: afterDelete } = deleteTask(tasks, 3);
  assert.equal(createTask(afterDelete, 'Replacement', T1).task.id, 3);
});

test('add: rejects empty, whitespace-only, and non-string descriptions', () => {
  assert.throws(() => createTask([], ''), ValidationError);
  assert.throws(() => createTask([], '   '), ValidationError);
  assert.throws(() => createTask([], undefined), ValidationError);
});

test('add: trims surrounding whitespace in descriptions', () => {
  const { task } = createTask([], '  padded  ', T1);
  assert.equal(task.description, 'padded');
});

test('update: changes description and updatedAt but preserves id, status, createdAt', () => {
  const tasks = makeTasks();
  const { tasks: updated } = updateTask(tasks, 1, 'Buy groceries and cook dinner', T2);
  const task = updated.find((t) => t.id === 1);
  assert.equal(task.description, 'Buy groceries and cook dinner');
  assert.equal(task.createdAt, T1); // createdAt must never change
  assert.equal(task.updatedAt, T2); // updatedAt must change
  assert.equal(task.status, 'todo'); // update must not reset status
  assert.equal(updated.find((t) => t.id === 2).description, 'Study for exam');
});

test('update: unknown ID is rejected', () => {
  assert.throws(() => updateTask(makeTasks(), 999, 'x', T2), ValidationError);
  assert.throws(() => updateTask(makeTasks(), 999, 'x', T2), /Task with ID 999 was not found/);
});

test('update: rejects empty description', () => {
  assert.throws(() => updateTask(makeTasks(), 1, '  ', T2), ValidationError);
});

test('mark-in-progress and mark-done change only the status', () => {
  const tasks = makeTasks();
  const inProgress = setTaskStatus(tasks, 2, 'in-progress', T2).tasks.find((t) => t.id === 2);
  assert.equal(inProgress.status, 'in-progress');
  assert.equal(inProgress.createdAt, T1);
  assert.equal(inProgress.updatedAt, T2);

  const done = setTaskStatus(tasks, 2, 'done', T2).tasks.find((t) => t.id === 2);
  assert.equal(done.status, 'done');
});

test('status change on unknown ID is rejected', () => {
  assert.throws(() => setTaskStatus(makeTasks(), 7, 'done', T2), /ID 7 was not found/);
});

test('delete: removes only the target task', () => {
  const { tasks } = deleteTask(makeTasks(), 1);
  assert.deepEqual(tasks.map((t) => t.id), [2]);
  assert.throws(() => deleteTask(tasks, 1), /ID 1 was not found/);
});

test('list: sorts by ID and filters by each exact status', () => {
  let tasks = makeTasks();
  tasks = setTaskStatus(tasks, 2, 'in-progress', T2).tasks;
  const third = createTask(tasks, 'Done task', T2).tasks;
  const all = setTaskStatus(third, 3, 'done', T2).tasks;

  assert.deepEqual(listTasks(all).map((t) => t.id), [1, 2, 3]);
  assert.deepEqual(listTasks(all, 'todo').map((t) => t.id), [1]);
  assert.deepEqual(listTasks(all, 'in-progress').map((t) => t.id), [2]);
  assert.deepEqual(listTasks(all, 'done').map((t) => t.id), [3]);
  assert.deepEqual(listTasks([], 'todo'), []);
  assert.deepEqual(listTasks([], null), []);
});

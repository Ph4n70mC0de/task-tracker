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
  searchTasks,
  filterTasks,
  sortTasks,
  getOverdueTasks,
  getTodayTasks,
  getWeekTasks,
  getStats,
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

test('add: supports optional fields via options', () => {
  const { task } = createTask([], 'Buy groceries', {
    title: 'Groceries',
    priority: 'high',
    project: 'Home',
    tags: ['shopping', 'urgent'],
    dueAt: '2026-09-15T18:00:00.000Z',
  }, T1);
  assert.equal(task.title, 'Groceries');
  assert.equal(task.description, 'Buy groceries');
  assert.equal(task.priority, 'high');
  assert.equal(task.project, 'Home');
  assert.deepEqual(task.tags, ['shopping', 'urgent']);
  assert.equal(task.dueAt, '2026-09-15T18:00:00.000Z');
  assert.equal(task.completedAt, null);
  assert.equal(task.createdAt, T1);
  assert.equal(task.updatedAt, T1);
});

test('add: title defaults to description when not provided', () => {
  const { task } = createTask([], 'Buy groceries', {}, T1);
  assert.equal(task.title, 'Buy groceries');
  assert.equal(task.priority, 'medium');
  assert.equal(task.project, null);
  assert.deepEqual(task.tags, []);
  assert.equal(task.dueAt, null);
});

test('update: supports optional field updates', () => {
  const tasks = makeTasks();
  const { tasks: updated } = updateTask(tasks, 1, 'Buy groceries and cook dinner', {
    title: 'Groceries',
    priority: 'low',
    project: 'Home',
    tags: ['shopping'],
    dueAt: '2026-09-20T00:00:00.000Z',
  }, T2);
  const task = updated.find((t) => t.id === 1);
  assert.equal(task.title, 'Groceries');
  assert.equal(task.description, 'Buy groceries and cook dinner');
  assert.equal(task.priority, 'low');
  assert.equal(task.project, 'Home');
  assert.deepEqual(task.tags, ['shopping']);
  assert.equal(task.dueAt, '2026-09-20T00:00:00.000Z');
  assert.equal(task.updatedAt, T2);
  assert.equal(task.createdAt, T1);
});

test('update: only specified fields change, others preserve', () => {
  const tasks = makeTasks();
  const { tasks: updated } = updateTask(tasks, 1, 'New description', { priority: 'urgent' }, T2);
  const task = updated.find((t) => t.id === 1);
  assert.equal(task.description, 'New description');
  assert.equal(task.priority, 'urgent');
  assert.equal(task.title, 'Buy groceries');
  assert.equal(task.project, null);
  assert.deepEqual(task.tags, []);
});

test('setTaskStatus done sets completedAt, other statuses clear it', () => {
  const tasks = makeTasks();
  const done = setTaskStatus(tasks, 2, 'done', T2).tasks.find((t) => t.id === 2);
  assert.equal(done.status, 'done');
  assert.equal(done.completedAt, T2);

  const inProgress = setTaskStatus(tasks, 2, 'in-progress', T2).tasks.find((t) => t.id === 2);
  assert.equal(inProgress.status, 'in-progress');
  assert.equal(inProgress.completedAt, null);

  const reopened = setTaskStatus(tasks, 2, 'todo', T2).tasks.find((t) => t.id === 2);
  assert.equal(reopened.status, 'todo');
  assert.equal(reopened.completedAt, null);
});

test('filterTasks: combines multiple criteria', () => {
  const tasks = makeTasks();
  const withPriority = tasks.map((t, i) => ({ ...t, priority: i === 1 ? 'high' : 'low', project: i === 1 ? 'Work' : 'Home', tags: i === 1 ? ['bug'] : ['feature'] }));
  const filtered = filterTasks(withPriority, { status: 'todo', priority: 'high', project: 'Work', tag: 'bug' });
  assert.deepEqual(filtered.map((t) => t.id), [2]);
});

test('filterTasks: search matches title, description, project, tags', () => {
  const tasks = [
    { id: 1, title: 'Buy milk', description: 'Get milk', status: 'todo', priority: 'medium', project: 'Home', tags: ['shopping'], dueAt: null, completedAt: null, createdAt: T1, updatedAt: T1 },
    { id: 2, title: 'Write code', description: 'Fix bug', status: 'todo', priority: 'medium', project: 'Work', tags: ['bug'], dueAt: null, completedAt: null, createdAt: T1, updatedAt: T1 },
  ];
  assert.deepEqual(searchTasks(tasks, 'milk').map((t) => t.id), [1]);
  assert.deepEqual(searchTasks(tasks, 'bug').map((t) => t.id), [2]);
  assert.deepEqual(searchTasks(tasks, 'Work').map((t) => t.id), [2]);
  assert.deepEqual(searchTasks(tasks, 'shopping').map((t) => t.id), [1]);
  assert.deepEqual(searchTasks(tasks, 'nonexistent'), []);
});

test('sortTasks: sorts by id, created, updated, due, priority, status', () => {
  const tasks = [
    { id: 1, title: 'A', description: 'A', status: 'done', priority: 'low', project: null, tags: [], dueAt: '2026-09-20T00:00:00.000Z', completedAt: null, createdAt: T2, updatedAt: T1 },
    { id: 2, title: 'B', description: 'B', status: 'todo', priority: 'high', project: null, tags: [], dueAt: '2026-09-10T00:00:00.000Z', completedAt: null, createdAt: T1, updatedAt: T2 },
  ];
  assert.deepEqual(sortTasks(tasks, 'id').map((t) => t.id), [1, 2]);
  assert.deepEqual(sortTasks(tasks, 'created').map((t) => t.id), [2, 1]);
  assert.deepEqual(sortTasks(tasks, 'updated').map((t) => t.id), [1, 2]);
  assert.deepEqual(sortTasks(tasks, 'due').map((t) => t.id), [2, 1]);
  assert.deepEqual(sortTasks(tasks, 'priority').map((t) => t.id), [1, 2]);
  assert.deepEqual(sortTasks(tasks, 'status').map((t) => t.id), [2, 1]);
});

test('getOverdueTasks: returns tasks past due date that are not done', () => {
  const now = new Date().toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const tasks = [
    { id: 1, title: 'A', description: 'A', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: past, completedAt: null, createdAt: T1, updatedAt: T1 },
    { id: 2, title: 'B', description: 'B', status: 'done', priority: 'medium', project: null, tags: [], dueAt: past, completedAt: now, createdAt: T1, updatedAt: now },
    { id: 3, title: 'C', description: 'C', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: future, completedAt: null, createdAt: T1, updatedAt: T1 },
  ];
  assert.deepEqual(getOverdueTasks(tasks).map((t) => t.id), [1]);
});

test('getTodayTasks: returns tasks due today', () => {
  const today = new Date().toISOString();
  const tasks = [
    { id: 1, title: 'A', description: 'A', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: today, completedAt: null, createdAt: T1, updatedAt: T1 },
    { id: 2, title: 'B', description: 'B', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: '2026-01-01T00:00:00.000Z', completedAt: null, createdAt: T1, updatedAt: T1 },
  ];
  assert.deepEqual(getTodayTasks(tasks).map((t) => t.id), [1]);
});

test('getWeekTasks: returns tasks due this week', () => {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const midWeek = new Date(startOfWeek.getTime() + 86400000 * 2).toISOString();
  const tasks = [
    { id: 1, title: 'A', description: 'A', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: midWeek, completedAt: null, createdAt: T1, updatedAt: T1 },
    { id: 2, title: 'B', description: 'B', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: '2026-01-01T00:00:00.000Z', completedAt: null, createdAt: T1, updatedAt: T1 },
  ];
  assert.deepEqual(getWeekTasks(tasks).map((t) => t.id), [1]);
});

test('getStats: returns correct counts', () => {
  const tasks = [
    { id: 1, title: 'A', description: 'A', status: 'todo', priority: 'medium', project: null, tags: [], dueAt: null, completedAt: null, createdAt: T1, updatedAt: T1 },
    { id: 2, title: 'B', description: 'B', status: 'in-progress', priority: 'medium', project: null, tags: [], dueAt: null, completedAt: null, createdAt: T1, updatedAt: T1 },
    { id: 3, title: 'C', description: 'C', status: 'done', priority: 'medium', project: null, tags: [], dueAt: null, completedAt: T2, createdAt: T1, updatedAt: T2 },
  ];
  const stats = getStats(tasks);
  assert.equal(stats.total, 3);
  assert.equal(stats.todo, 1);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.done, 1);
  assert.equal(stats.overdue, 0);
});

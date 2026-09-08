'use strict';

// Storage tests run against a temporary directory via TASK_TRACKER_FILE.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const storage = require('../src/storage');
const { ValidationError } = require('../src/validation');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-tracker-'));
  process.env.TASK_TRACKER_FILE = path.join(tmpDir, 'tasks.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.TASK_TRACKER_FILE;
});

const TASK = {
  id: 1,
  description: 'Buy groceries',
  status: 'todo',
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};

test('ensureStorageFile creates tasks.json with an empty array when missing', () => {
  assert.equal(fs.existsSync(process.env.TASK_TRACKER_FILE), false);
  storage.ensureStorageFile();
  assert.equal(fs.readFileSync(process.env.TASK_TRACKER_FILE, 'utf8'), '[]\n');
  // Existing files are left untouched.
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, '[{"id":1}]');
  storage.ensureStorageFile();
  assert.equal(fs.readFileSync(process.env.TASK_TRACKER_FILE, 'utf8'), '[{"id":1}]');
});

test('loadTasks round-trips tasks saved by saveTasks', () => {
  storage.ensureStorageFile();
  storage.saveTasks([TASK]);
  const loaded = storage.loadTasks();
  assert.deepEqual(loaded, [TASK]);
});

test('loadTasks rejects malformed JSON instead of silently overwriting it', () => {
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, '{not json');
  assert.throws(() => storage.loadTasks(), ValidationError);
  assert.equal(fs.readFileSync(process.env.TASK_TRACKER_FILE, 'utf8'), '{not json');
});

test('loadTasks rejects an empty file', () => {
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, '');
  assert.throws(() => storage.loadTasks(), /empty/);
});

test('loadTasks rejects a non-array top level structure', () => {
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, '{"tasks":[]}');
  assert.throws(() => storage.loadTasks(), /JSON array/);
});

test('loadTasks rejects records with invalid fields', () => {
  const bad = [{ ...TASK, status: 'finished' }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(bad));
  assert.throws(() => storage.loadTasks(), /invalid task record/);

  const badId = [{ ...TASK, id: 'one' }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(badId));
  assert.throws(() => storage.loadTasks(), /invalid task record/);
});

test('loadTasks rejects duplicate task IDs', () => {
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify([TASK, TASK]));
  assert.throws(() => storage.loadTasks(), /duplicate task IDs/);
});

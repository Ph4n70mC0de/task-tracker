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
  title: 'Buy groceries',
  description: 'Buy groceries',
  status: 'todo',
  priority: 'medium',
  project: null,
  tags: [],
  dueAt: null,
  completedAt: null,
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
  assert.deepEqual(loaded, [{ ...TASK, __version: 2 }]);
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

test('loadTasks rejects records with a non-string description', () => {
  const bad = [{ ...TASK, description: 42 }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(bad));
  assert.throws(() => storage.loadTasks(), /invalid task record/);
});

test('saveTasks leaves no temp file behind on success', () => {
  storage.ensureStorageFile();
  storage.saveTasks([TASK]);
  assert.equal(fs.existsSync(process.env.TASK_TRACKER_FILE + '.tmp'), false);
  assert.deepEqual(storage.loadTasks(), [{ ...TASK, __version: 2 }]);
});

test('saveTasks cleans up the temp file when the final rename fails', () => {
  storage.ensureStorageFile();
  storage.saveTasks([TASK]);
  // Simulate an unwritable target: replace tasks.json with a directory so
  // the final rename fails after the temp file has been written.
  fs.unlinkSync(process.env.TASK_TRACKER_FILE);
  fs.mkdirSync(process.env.TASK_TRACKER_FILE);
  assert.throws(() => storage.saveTasks([TASK]), /Could not write/);
  assert.equal(fs.existsSync(process.env.TASK_TRACKER_FILE + '.tmp'), false);
});

test('loadTasks migrates v1 records to v2 with defaults', () => {
  const v1 = [
    {
      id: 1,
      description: 'Buy groceries',
      status: 'todo',
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:00:00.000Z',
    },
  ];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(v1));
  const loaded = storage.loadTasks();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].__version, 2);
  assert.equal(loaded[0].title, 'Buy groceries');
  assert.equal(loaded[0].priority, 'medium');
  assert.equal(loaded[0].project, null);
  assert.deepEqual(loaded[0].tags, []);
  assert.equal(loaded[0].dueAt, null);
  assert.equal(loaded[0].completedAt, null);
  assert.equal(loaded[0].description, 'Buy groceries');
});

test('loadTasks does not re-save if already v2', () => {
  storage.ensureStorageFile();
  storage.saveTasks([TASK]);
  const mtimeBefore = fs.statSync(process.env.TASK_TRACKER_FILE).mtimeMs;
  const loaded = storage.loadTasks();
  const mtimeAfter = fs.statSync(process.env.TASK_TRACKER_FILE).mtimeMs;
  assert.deepEqual(loaded, [{ ...TASK, __version: 2 }]);
  assert.equal(mtimeBefore, mtimeAfter);
});

test('loadTasks rejects records with invalid priority', () => {
  const bad = [{ ...TASK, priority: 'critical' }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(bad));
  assert.throws(() => storage.loadTasks(), /invalid task record/);
});

test('loadTasks rejects records with invalid dueAt type', () => {
  const bad = [{ ...TASK, dueAt: 123 }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(bad));
  assert.throws(() => storage.loadTasks(), /invalid task record/);
});

test('loadTasks rejects records with non-array tags', () => {
  const bad = [{ ...TASK, tags: 'tag1,tag2' }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(bad));
  assert.throws(() => storage.loadTasks(), /invalid task record/);
});

test('loadTasks rejects records with non-string tag', () => {
  const bad = [{ ...TASK, tags: [1, 2] }];
  fs.writeFileSync(process.env.TASK_TRACKER_FILE, JSON.stringify(bad));
  assert.throws(() => storage.loadTasks(), /invalid task record/);
});


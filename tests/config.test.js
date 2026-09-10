'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  getEffectiveConfig,
  colorMode,
  resolveStoragePath,
  loadConfigFile,
  configFilePaths,
  DEFAULTS,
  ENV_MAP,
} = require('../src/config');

let originalEnv = {};
let tmpDir;

function captureEnv() {
  originalEnv = {};
  for (const envVar of Object.values(ENV_MAP)) {
    originalEnv[envVar] = process.env[envVar];
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  captureEnv();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-tracker-config-'));
  process.chdir(tmpDir);
});

afterEach(() => {
  restoreEnv();
  try { process.chdir(os.homedir()); } catch { /* ignore */ }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('defaults are returned when no env vars or config file are set', () => {
  const config = getEffectiveConfig();
  assert.equal(config.file, DEFAULTS.file);
  assert.equal(config.color, DEFAULTS.color);
  assert.equal(config.dateFormat, DEFAULTS.dateFormat);
  assert.equal(config.defaultProject, DEFAULTS.defaultProject);
});

test('environment variables override defaults', () => {
  process.env.TASK_TRACKER_FILE = '/custom/tasks.json';
  process.env.TASK_TRACKER_COLOR = 'never';
  const config = getEffectiveConfig();
  assert.equal(config.file, '/custom/tasks.json');
  assert.equal(config.color, 'never');
});

test('config file values override defaults but not env vars', () => {
  fs.writeFileSync(path.join(tmpDir, 'task-tracker.json'), JSON.stringify({ file: '/config/tasks.json', color: 'always' }));
  process.env.TASK_TRACKER_FILE = '/env/tasks.json';
  const config = getEffectiveConfig();
  assert.equal(config.file, '/env/tasks.json');
  assert.equal(config.color, 'always');
});

test('CLI overrides take precedence over config file and env vars', () => {
  fs.writeFileSync(path.join(tmpDir, 'task-tracker.json'), JSON.stringify({ file: '/config/tasks.json' }));
  process.env.TASK_TRACKER_FILE = '/env/tasks.json';
  const config = getEffectiveConfig({ file: '/cli/tasks.json' });
  assert.equal(config.file, '/cli/tasks.json');
});

test('CLI overrides work even when value is empty string (treated as set)', () => {
  const config = getEffectiveConfig({ color: 'never' });
  assert.equal(config.color, 'never');
});

test('invalid color value falls back to default', () => {
  process.env.TASK_TRACKER_COLOR = 'invalid-value';
  const config = getEffectiveConfig();
  assert.equal(config.color, DEFAULTS.color);
});

test('colorMode returns true for always, false for never, null for auto', () => {
  assert.equal(colorMode({ color: 'always' }), true);
  assert.equal(colorMode({ color: 'never' }), false);
  assert.equal(colorMode({ color: 'auto' }), null);
});

test('resolveStoragePath returns the configured file path', () => {
  const config = { file: '/custom/tasks.json' };
  assert.equal(resolveStoragePath(config), '/custom/tasks.json');
});

test('resolveStoragePath returns default when not configured', () => {
  const config = { ...DEFAULTS };
  assert.equal(resolveStoragePath(config), DEFAULTS.file);
});

test('config file is read from current working directory', () => {
  fs.writeFileSync(path.join(tmpDir, 'task-tracker.json'), JSON.stringify({ file: '/cwd/tasks.json' }));
  const config = getEffectiveConfig();
  assert.equal(config.file, '/cwd/tasks.json');
});

test('config file is read from .task-tracker.json in current directory', () => {
  fs.writeFileSync(path.join(tmpDir, '.task-tracker.json'), JSON.stringify({ file: '/dotfile/tasks.json' }));
  const config = getEffectiveConfig();
  assert.equal(config.file, '/dotfile/tasks.json');
});

test('config file is read from home directory', () => {
  const homeDir = os.homedir();
  const dotDir = path.join(homeDir, '.task-tracker');
  if (!fs.existsSync(dotDir)) {
    fs.mkdirSync(dotDir, { recursive: true });
  }
  const homeConfigPath = path.join(dotDir, 'task-tracker.json');
  fs.writeFileSync(homeConfigPath, JSON.stringify({ file: '/home/tasks.json' }));
  const config = getEffectiveConfig();
  assert.equal(config.file, '/home/tasks.json');
  fs.unlinkSync(homeConfigPath);
});

test('malformed config file is silently ignored', () => {
  fs.writeFileSync(path.join(tmpDir, 'task-tracker.json'), '{not json');
  const config = getEffectiveConfig();
  assert.equal(config.file, DEFAULTS.file);
});

test('config file with array top-level is silently ignored', () => {
  fs.writeFileSync(path.join(tmpDir, 'task-tracker.json'), JSON.stringify([]));
  const config = getEffectiveConfig();
  assert.equal(config.file, DEFAULTS.file);
});

test('configFilePaths returns expected paths', () => {
  const paths = configFilePaths();
  const homeDir = os.homedir();
  assert.ok(paths.some((p) => p.includes(path.join(process.cwd(), 'task-tracker.json'))));
  assert.ok(paths.some((p) => p.includes(path.join(process.cwd(), '.task-tracker.json'))));
  if (homeDir) {
    assert.ok(paths.some((p) => p.includes(path.join(homeDir, '.task-tracker', 'task-tracker.json'))));
  }
});

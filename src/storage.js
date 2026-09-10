'use strict';

const fs = require('fs');
const path = require('path');
const { ValidationError, validateTasksData, migrateTask, SCHEMA_VERSION } = require('./validation');

function storageFilePath() {
  return process.env.TASK_TRACKER_FILE || 'tasks.json';
}

function storageDir() {
  return path.dirname(storageFilePath());
}

function storageBaseName() {
  return path.basename(storageFilePath());
}

function ensureStorageFile() {
  const file = storageFilePath();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]\n', 'utf8');
  }
  return file;
}

function loadTasks() {
  const file = ensureStorageFile();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
  if (raw.trim() === '') {
    throw new ValidationError(
      `${file} is empty. Expected a JSON array of tasks; fix or delete the file and try again.`
    );
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`${file} is not valid JSON: ${err.message}`);
  }
  const validated = validateTasksData(data);
  const migrated = validated.map(migrateTask);
  if (JSON.stringify(migrated) !== JSON.stringify(validated)) {
    saveTasks(migrated);
  }
  return migrated;
}

function saveTasks(tasks) {
  const file = storageFilePath();
  const tmpFile = file + '.tmp';
  const versioned = tasks.map((task) => ({ ...task, __version: SCHEMA_VERSION }));
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(versioned, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpFile, file);
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup failure; the original error matters more
    }
    throw new Error(`Could not write ${file}: ${err.message}`);
  }
  return tasks;
}

function backupTasks() {
  const srcFile = storageFilePath();
  if (!fs.existsSync(srcFile)) {
    throw new Error(`Cannot back up: ${srcFile} does not exist.`);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.basename(srcFile, path.extname(srcFile));
  const dir = storageDir();
  const backupName = `${base}.backup.${timestamp}.json`;
  const backupPath = path.join(dir, backupName);
  try {
    fs.copyFileSync(srcFile, backupPath);
  } catch (err) {
    throw new Error(`Could not create backup: ${err.message}`);
  }
  return backupPath;
}

function recoverTasks(backupPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(backupPath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read backup file: ${err.message}`);
  }
  if (raw.trim() === '') {
    throw new ValidationError(`Backup file ${backupPath} is empty.`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Backup file ${backupPath} is not valid JSON: ${err.message}`);
  }
  const validated = validateTasksData(data);
  const migrated = validated.map(migrateTask);
  const destFile = storageFilePath();
  const tmpFile = destFile + '.tmp';
  const versioned = migrated.map((task) => ({ ...task, __version: SCHEMA_VERSION }));
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(versioned, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpFile, destFile);
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup failure
    }
    throw new Error(`Could not restore to ${destFile}: ${err.message}`);
  }
  return migrated;
}

function exportTasks(exportPath) {
  const tasks = loadTasks();
  const dir = path.dirname(exportPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload = {
    __version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
  };
  fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return exportPath;
}

function importTasks(importPath) {
  if (!fs.existsSync(importPath)) {
    throw new Error(`Import file not found: ${importPath}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(importPath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read import file: ${err.message}`);
  }
  if (raw.trim() === '') {
    throw new ValidationError(`Import file ${importPath} is empty.`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Import file ${importPath} is not valid JSON: ${err.message}`);
  }
  let incoming = [];
  if (Array.isArray(data)) {
    incoming = data;
  } else if (data && Array.isArray(data.tasks)) {
    incoming = data.tasks;
  } else {
    throw new ValidationError(
      `Import file must contain a JSON array of tasks or an object with a "tasks" array.`
    );
  }
  const validated = validateTasksData(incoming);
  const migrated = validated.map(migrateTask);
  const existing = loadTasks();
  const existingIds = new Set(existing.map((t) => t.id));
  const merged = [...existing];
  for (const task of migrated) {
    if (!existingIds.has(task.id)) {
      merged.push(task);
      existingIds.add(task.id);
    }
  }
  saveTasks(merged);
  const importedCount = merged.length - existing.length;
  const skippedCount = incoming.length - migrated.length + (migrated.length - importedCount);
  return { imported: importedCount, skipped: skippedCount, total: merged.length };
}

module.exports = {
  storageFilePath,
  storageDir,
  storageBaseName,
  ensureStorageFile,
  loadTasks,
  saveTasks,
  backupTasks,
  recoverTasks,
  exportTasks,
  importTasks,
};

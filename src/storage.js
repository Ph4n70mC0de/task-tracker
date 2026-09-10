'use strict';

const fs = require('fs');
const { ValidationError, validateTasksData, migrateTask, SCHEMA_VERSION } = require('./validation');

function storageFilePath() {
  return process.env.TASK_TRACKER_FILE || 'tasks.json';
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

module.exports = { storageFilePath, ensureStorageFile, loadTasks, saveTasks };

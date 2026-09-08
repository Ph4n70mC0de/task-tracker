'use strict';

const fs = require('fs');
const { ValidationError, validateTasksData } = require('./validation');

// The data file lives in the current working directory, as required by the spec.
// TASK_TRACKER_FILE exists only so the test suite can point at a temp directory.
function storageFilePath() {
  return process.env.TASK_TRACKER_FILE || 'tasks.json';
}

/**
 * Create tasks.json with an empty collection when it does not exist.
 * An existing file is left untouched.
 */
function ensureStorageFile() {
  const file = storageFilePath();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]\n', 'utf8');
  }
  return file;
}

/**
 * Load and validate all tasks. Creates the file on first use.
 * Never silently replaces unreadable data: an empty or malformed file is an error.
 */
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
  return validateTasksData(data);
}

/**
 * Write the task collection back to disk in a readable, stable format.
 * Writes to a temporary file and renames it into place so a crash mid-write
 * can never leave a partially written (corrupt) tasks.json behind.
 */
function saveTasks(tasks) {
  const file = storageFilePath();
  const tmpFile = file + '.tmp';
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(tasks, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpFile, file);
  } catch (err) {
    // Best-effort cleanup so a failed save does not leave litter behind.
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

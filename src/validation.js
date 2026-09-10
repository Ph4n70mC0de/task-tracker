'use strict';

const STATUSES = Object.freeze(['todo', 'in-progress', 'done']);

const PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);

const STATUS_COMMAND_MAP = Object.freeze({
  'mark-in-progress': 'in-progress',
  'mark-done': 'done',
  start: 'in-progress',
  done: 'done',
  reopen: 'todo',
});

const SCHEMA_VERSION = 2;

class ValidationError extends Error {}

class CliError extends Error {}

function cleanDescription(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('Description must be a non-empty string.');
  }
  return raw.trim();
}

function parseTaskId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError(`"${raw}" is not a valid task ID. Use a positive integer.`);
  }
  return id;
}

function parseStatusFilter(raw) {
  if (!STATUSES.includes(raw)) {
    throw new ValidationError(
      `"${raw}" is not a valid list filter. Supported filters: ${STATUSES.join(', ')}.`
    );
  }
  return raw;
}

function parsePriority(raw) {
  if (!PRIORITIES.includes(raw)) {
    throw new ValidationError(
      `"${raw}" is not a valid priority. Supported priorities: ${PRIORITIES.join(', ')}.`
    );
  }
  return raw;
}

function parseDueDate(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`"${raw}" is not a valid ISO-8601 date.`);
  }
  return date.toISOString();
}

function parseTags(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }
  return raw.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);
}

function resolveCommandStatus(command) {
  const status = STATUS_COMMAND_MAP[command];
  if (!status) {
    throw new CliError(`Command "${command}" does not change task status.`);
  }
  return status;
}

function migrateTask(task) {
  if (task.__version === SCHEMA_VERSION) {
    return task;
  }
  const migrated = { ...task, __version: SCHEMA_VERSION };
  if (!migrated.title) {
    migrated.title = migrated.description;
  }
  if (!migrated.priority) {
    migrated.priority = 'medium';
  }
  if (!migrated.project) {
    migrated.project = null;
  }
  if (!migrated.tags) {
    migrated.tags = [];
  }
  if (!migrated.dueAt) {
    migrated.dueAt = null;
  }
  if (!migrated.completedAt) {
    migrated.completedAt = null;
  }
  if (!migrated.archived) {
    migrated.archived = false;
  }
  return migrated;
}

function validateTaskRecord(task) {
  if (
    task === null ||
    typeof task !== 'object' ||
    !Number.isInteger(task.id) ||
    task.id < 1 ||
    typeof task.description !== 'string' ||
    !STATUSES.includes(task.status) ||
    typeof task.createdAt !== 'string' ||
    typeof task.updatedAt !== 'string'
  ) {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (task.title !== undefined && typeof task.title !== 'string') {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (task.priority !== undefined && !PRIORITIES.includes(task.priority)) {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (task.project !== undefined && task.project !== null && typeof task.project !== 'string') {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (task.tags !== undefined && !Array.isArray(task.tags)) {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (Array.isArray(task.tags)) {
    for (const tag of task.tags) {
      if (typeof tag !== 'string') {
        throw new ValidationError(
          `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
        );
      }
    }
  }
  if (task.dueAt !== undefined && task.dueAt !== null && typeof task.dueAt !== 'string') {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (task.completedAt !== undefined && task.completedAt !== null && typeof task.completedAt !== 'string') {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
  if (task.archived !== undefined && typeof task.archived !== 'boolean') {
    throw new ValidationError(
      `tasks.json contains an invalid task record: ${JSON.stringify(task)}`
    );
  }
}

function validateTasksData(data) {
  if (!Array.isArray(data)) {
    throw new ValidationError('tasks.json must contain a JSON array of tasks.');
  }
  const seenIds = new Set();
  for (const task of data) {
    validateTaskRecord(task);
    if (seenIds.has(task.id)) {
      throw new ValidationError(`tasks.json contains duplicate task IDs (ID: ${task.id}).`);
    }
    seenIds.add(task.id);
  }
  return data;
}

module.exports = {
  STATUSES,
  PRIORITIES,
  STATUS_COMMAND_MAP,
  SCHEMA_VERSION,
  ValidationError,
  CliError,
  cleanDescription,
  parseTaskId,
  parseStatusFilter,
  parsePriority,
  parseDueDate,
  parseTags,
  resolveCommandStatus,
  migrateTask,
  validateTaskRecord,
  validateTasksData,
};

'use strict';

// Status values are constrained to this list everywhere in the application.
const STATUSES = Object.freeze(['todo', 'in-progress', 'done']);

// Validation errors are user-facing: they mean "fix your input".
class ValidationError extends Error {}

// CLI errors mean "your command line was wrong" (usage problems).
class CliError extends Error {}

/**
 * Trim and validate a task description.
 * Returns the trimmed description; throws for missing/empty/whitespace input.
 */
function cleanDescription(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('Description must be a non-empty string.');
  }
  return raw.trim();
}

/**
 * Parse a positional argument into a positive integer task ID.
 */
function parseTaskId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError(`"${raw}" is not a valid task ID. Use a positive integer.`);
  }
  return id;
}

/**
 * Validate an optional `list` filter argument.
 */
function parseStatusFilter(raw) {
  if (!STATUSES.includes(raw)) {
    throw new ValidationError(
      `"${raw}" is not a valid list filter. Supported filters: ${STATUSES.join(', ')}.`
    );
  }
  return raw;
}

/**
 * Validate the parsed contents of tasks.json: it must be an array of well-formed
 * task records with unique IDs. This protects against silently working with
 * corrupt or unexpected data.
 */
function validateTasksData(data) {
  if (!Array.isArray(data)) {
    throw new ValidationError('tasks.json must contain a JSON array of tasks.');
  }
  const seenIds = new Set();
  for (const task of data) {
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
    if (seenIds.has(task.id)) {
      throw new ValidationError(`tasks.json contains duplicate task IDs (ID: ${task.id}).`);
    }
    seenIds.add(task.id);
  }
  return data;
}

module.exports = {
  STATUSES,
  ValidationError,
  CliError,
  cleanDescription,
  parseTaskId,
  parseStatusFilter,
  validateTasksData,
};

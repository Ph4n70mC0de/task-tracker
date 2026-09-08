'use strict';

/**
 * Human-readable, deterministic presentation of tasks and command results.
 * Kept separate from parsing and business logic so the output format can
 * change without touching behavior.
 */

function formatTask(task) {
  return [
    `ID: ${task.id} | ${task.status} | ${task.description}`,
    `Created: ${task.createdAt}`,
    `Updated: ${task.updatedAt}`,
  ].join('\n');
}

function formatTaskList(tasks) {
  if (tasks.length === 0) {
    return 'No tasks found.';
  }
  return tasks.map(formatTask).join('\n\n');
}

module.exports = { formatTask, formatTaskList };

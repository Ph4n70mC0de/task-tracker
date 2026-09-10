'use strict';

const COLORS = Object.freeze({
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
});

const STATUS_COLORS = Object.freeze({
  'todo': 'blue',
  'in-progress': 'yellow',
  'done': 'green',
});

let forceColor = null;

function setForceColor(value) {
  forceColor = value;
}

function colorEnabled() {
  if (forceColor === false) return false;
  if (forceColor === true) return true;
  return !!process.stdout.isTTY;
}

function colorize(text, colorName) {
  if (!colorEnabled()) return text;
  const code = COLORS[colorName] || COLORS.reset;
  return code + text + COLORS.reset;
}

function formatStatus(status) {
  return colorize(status, STATUS_COLORS[status] || 'reset');
}

function formatTask(task) {
  return [
    `ID: ${task.id} | ${formatStatus(task.status)} | ${task.description}`,
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

function formatTaskJson(task) {
  return JSON.stringify(task, null, 2);
}

function formatTaskListJson(tasks) {
  return JSON.stringify(tasks, null, 2);
}

module.exports = {
  formatTask,
  formatTaskList,
  formatTaskJson,
  formatTaskListJson,
  setForceColor,
  colorEnabled,
  colorize,
  formatStatus,
};

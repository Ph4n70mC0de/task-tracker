'use strict';

const { ValidationError, cleanDescription } = require('./validation');

/**
 * Task business rules. These functions are pure: they take a task collection
 * and return a new collection plus the affected task, never touching disk.
 * Storage (load/save) stays in storage.js so file access is centralized.
 */

function findTask(tasks, id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    throw new ValidationError(`Task with ID ${id} was not found.`);
  }
  return task;
}

// Next available ID is the highest existing ID + 1; IDs are never reused
// while a task still holds them. Starts at 1 for an empty collection.
function nextId(tasks) {
  return tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}

/**
 * Create a new task with status `todo` and matching createdAt/updatedAt.
 */
function createTask(tasks, rawDescription, now = new Date().toISOString()) {
  const description = cleanDescription(rawDescription);
  const task = {
    id: nextId(tasks),
    description,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  };
  return { tasks: [...tasks, task], task };
}

/**
 * Replace a task description. Preserves id, status, and createdAt; refreshes updatedAt.
 */
function updateTask(tasks, id, rawDescription, now = new Date().toISOString()) {
  findTask(tasks, id);
  const description = cleanDescription(rawDescription);
  return {
    tasks: tasks.map((t) =>
      t.id === id ? { ...t, description, updatedAt: now } : t
    ),
  };
}

/**
 * Remove a task by ID; all other tasks are untouched.
 */
function deleteTask(tasks, id) {
  findTask(tasks, id);
  return { tasks: tasks.filter((t) => t.id !== id) };
}

/**
 * Set a task's status. Both mark commands funnel through here so no other
 * status value can ever be written. createdAt and description are preserved.
 */
function setTaskStatus(tasks, id, status, now = new Date().toISOString()) {
  findTask(tasks, id);
  return {
    tasks: tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: now } : t)),
  };
}

/**
 * Return tasks sorted by ID, optionally filtered by an exact status match.
 */
function listTasks(tasks, filter = null) {
  return tasks
    .filter((t) => (filter === null ? true : t.status === filter))
    .sort((a, b) => a.id - b.id);
}

module.exports = { findTask, nextId, createTask, updateTask, deleteTask, setTaskStatus, listTasks };

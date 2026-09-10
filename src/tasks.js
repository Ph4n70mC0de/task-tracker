'use strict';

const { ValidationError, cleanDescription, parsePriority, parseTags, parseDueDate, PRIORITIES, STATUSES } = require('./validation');

function findTask(tasks, id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    throw new ValidationError(`Task with ID ${id} was not found.`);
  }
  return task;
}

function nextId(tasks) {
  return tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}

function createTask(tasks, rawDescription, optionsOrNow, now) {
  let options = {};
  if (typeof optionsOrNow === 'string') {
    now = optionsOrNow;
  } else if (typeof optionsOrNow === 'object' && optionsOrNow !== null) {
    options = optionsOrNow;
  }
  if (typeof now !== 'string') {
    now = new Date().toISOString();
  }
  const description = cleanDescription(rawDescription);
  const title = typeof options.title === 'string' && options.title.trim() !== ''
    ? options.title.trim()
    : description;
  const priority = typeof options.priority === 'string' ? options.priority : 'medium';
  const project = typeof options.project === 'string' ? options.project : null;
  const tags = Array.isArray(options.tags) ? options.tags : [];
  const dueAt = typeof options.dueAt === 'string' ? options.dueAt : null;
  const task = {
    id: nextId(tasks),
    title,
    description,
    status: 'todo',
    priority,
    project,
    tags,
    dueAt,
    completedAt: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  return { tasks: [...tasks, task], task };
}

function updateTask(tasks, id, rawDescription, optionsOrNow, now) {
  let options = {};
  if (typeof optionsOrNow === 'string') {
    now = optionsOrNow;
  } else if (typeof optionsOrNow === 'object' && optionsOrNow !== null) {
    options = optionsOrNow;
  }
  if (typeof now !== 'string') {
    now = new Date().toISOString();
  }
  findTask(tasks, id);
  const description = rawDescription !== undefined ? cleanDescription(rawDescription) : undefined;
  const title = typeof options.title === 'string' && options.title.trim() !== ''
    ? options.title.trim()
    : undefined;
  const priority = typeof options.priority === 'string' ? options.priority : undefined;
  const project = typeof options.project === 'string' ? options.project : undefined;
  const tags = Array.isArray(options.tags) ? options.tags : undefined;
  const dueAt = typeof options.dueAt === 'string' ? options.dueAt : undefined;
  return {
    tasks: tasks.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, updatedAt: now };
      if (description !== undefined) updated.description = description;
      if (title !== undefined) updated.title = title;
      if (priority !== undefined) updated.priority = priority;
      if (project !== undefined) updated.project = project;
      if (tags !== undefined) updated.tags = tags;
      if (dueAt !== undefined) updated.dueAt = dueAt;
      return updated;
    }),
  };
}

function deleteTask(tasks, id) {
  findTask(tasks, id);
  return { tasks: tasks.filter((t) => t.id !== id) };
}

function setTaskStatus(tasks, id, status, now = new Date().toISOString()) {
  findTask(tasks, id);
  const completedAt = status === 'done' ? now : null;
  return {
    tasks: tasks.map((t) =>
      t.id === id ? { ...t, status, completedAt, updatedAt: now } : t
    ),
  };
}

function matchesStatus(task, status) {
  if (!status) return true;
  return task.status === status;
}

function matchesPriority(task, priority) {
  if (!priority) return true;
  return task.priority === priority;
}

function matchesProject(task, project) {
  if (!project) return true;
  return task.project === project;
}

function matchesTag(task, tag) {
  if (!tag) return true;
  return task.tags.includes(tag);
}

function matchesQuery(task, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const searchFields = [task.title, task.description, task.project, ...task.tags];
  return searchFields.some((field) => typeof field === 'string' && field.toLowerCase().includes(q));
}

function matchesArchived(task, archived) {
  if (archived === undefined) return !task.archived;
  if (archived === null) return true;
  return !!task.archived === archived;
}

function filterTasks(tasks, options = {}) {
  const { status, priority, project, tag, query, archived } = options;
  return tasks.filter((t) =>
    matchesStatus(t, status) &&
    matchesPriority(t, priority) &&
    matchesProject(t, project) &&
    matchesTag(t, tag) &&
    matchesQuery(t, query) &&
    matchesArchived(t, archived)
  );
}

const SORT_MAP = {
  id: (a, b) => a.id - b.id,
  created: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  updated: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
  due: (a, b) => {
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return da - db;
  },
  priority: (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
};

function sortTasks(tasks, sortBy = 'id') {
  const comparator = SORT_MAP[sortBy] || SORT_MAP.id;
  return [...tasks].sort(comparator);
}

function listTasks(tasks, filter = null, sortBy = 'id') {
  let options = {};
  if (typeof filter === 'string') {
    options.status = filter;
  } else if (filter) {
    options = filter;
  }
  const filtered = filterTasks(tasks, options);
  return sortTasks(filtered, sortBy);
}

function searchTasks(tasks, query) {
  if (!query) return [];
  return sortTasks(filterTasks(tasks, { query }), 'id');
}

function isOverdue(task) {
  if (!task.dueAt || task.status === 'done') return false;
  return new Date(task.dueAt) < new Date();
}

function isToday(task) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  const now = new Date();
  return due.toDateString() === now.toDateString();
}

function isThisWeek(task) {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  const now = new Date();
  const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return dueLocal >= startOfWeek && dueLocal < endOfWeek;
}

function getOverdueTasks(tasks) {
  return tasks.filter(isOverdue);
}

function getTodayTasks(tasks) {
  return tasks.filter(isToday);
}

function getWeekTasks(tasks) {
  return tasks.filter(isThisWeek);
}

function getStats(tasks) {
  const now = new Date();
  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter((t) => isOverdue(t)).length,
    today: tasks.filter((t) => isToday(t)).length,
    thisWeek: tasks.filter((t) => isThisWeek(t)).length,
  };
  return stats;
}

function archiveTask(tasks, id, now = new Date().toISOString()) {
  findTask(tasks, id);
  return {
    tasks: tasks.map((t) =>
      t.id === id ? { ...t, archived: true, updatedAt: now } : t
    ),
  };
}

function restoreTask(tasks, id, now = new Date().toISOString()) {
  findTask(tasks, id);
  return {
    tasks: tasks.map((t) =>
      t.id === id ? { ...t, archived: false, updatedAt: now } : t
    ),
  };
}

function isArchived(task) {
  return !!task.archived;
}

function getArchivedTasks(tasks) {
  return tasks.filter(isArchived);
}

module.exports = {
  findTask,
  nextId,
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  listTasks,
  searchTasks,
  filterTasks,
  sortTasks,
  getOverdueTasks,
  getTodayTasks,
  getWeekTasks,
  getStats,
  archiveTask,
  restoreTask,
  isArchived,
  getArchivedTasks,
  isOverdue,
  isToday,
  isThisWeek,
};

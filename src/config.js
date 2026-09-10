'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  file: 'tasks.json',
  color: 'auto',
  dateFormat: 'local',
  defaultProject: null,
});

const ENV_MAP = Object.freeze({
  file: 'TASK_TRACKER_FILE',
  color: 'TASK_TRACKER_COLOR',
  dateFormat: 'TASK_TRACKER_DATE_FORMAT',
  defaultProject: 'TASK_TRACKER_DEFAULT_PROJECT',
});

const CONFIG_FILE_NAMES = Object.freeze([
  'task-tracker.json',
  '.task-tracker.json',
]);

function configFilePaths() {
  const cwd = process.cwd();
  const home = os.homedir();
  const paths = [];
  for (const name of CONFIG_FILE_NAMES) {
    paths.push(path.join(cwd, name));
  }
  if (home) {
    const dotDir = path.join(home, '.task-tracker');
    for (const name of CONFIG_FILE_NAMES) {
      paths.push(path.join(dotDir, name));
    }
  }
  return paths;
}

function loadConfigFile() {
  for (const filePath of configFilePaths()) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // ignore unreadable or malformed config files
    }
  }
  return null;
}

function getEffectiveConfig(cliOverrides = {}) {
  const configFile = loadConfigFile();
  const config = { ...DEFAULTS };

  if (configFile) {
    for (const key of Object.keys(DEFAULTS)) {
      if (configFile[key] !== undefined && configFile[key] !== null) {
        config[key] = configFile[key];
      }
    }
  }

  for (const [key, envVar] of Object.entries(ENV_MAP)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined && envValue !== null && envValue !== '') {
      config[key] = envValue;
    }
  }

  for (const key of Object.keys(DEFAULTS)) {
    if (cliOverrides[key] !== undefined && cliOverrides[key] !== null) {
      config[key] = cliOverrides[key];
    }
  }

  if (config.color !== 'auto' && config.color !== 'always' && config.color !== 'never') {
    config.color = DEFAULTS.color;
  }

  return config;
}

function colorMode(config) {
  if (config.color === 'always') return true;
  if (config.color === 'never') return false;
  return null;
}

function resolveStoragePath(config) {
  return config.file;
}

module.exports = {
  DEFAULTS,
  ENV_MAP,
  getEffectiveConfig,
  colorMode,
  resolveStoragePath,
  loadConfigFile,
  configFilePaths,
};

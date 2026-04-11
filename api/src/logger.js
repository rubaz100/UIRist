'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, msg, data = {}) {
  if (LEVELS[level] > currentLevel) return;
  const entry = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...data,
  });
  if (level === 'error' || level === 'warn') process.stderr.write(entry + '\n');
  else process.stdout.write(entry + '\n');
}

module.exports = {
  info:  (msg, data) => log('info',  msg, data),
  warn:  (msg, data) => log('warn',  msg, data),
  error: (msg, data) => log('error', msg, data),
  debug: (msg, data) => log('debug', msg, data),
};

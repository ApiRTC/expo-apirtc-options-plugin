export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLevel: LogLevel = 'warn';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

export const logger = {
  error(...args: any[]) {
    if (shouldLog('error')) console.error('[expo-apirtc]', ...args);
  },
  warn(...args: any[]) {
    if (shouldLog('warn')) console.warn('[expo-apirtc]', ...args);
  },
  info(...args: any[]) {
    if (shouldLog('info')) console.log('[expo-apirtc]', ...args);
  },
  debug(...args: any[]) {
    if (shouldLog('debug')) console.log('[expo-apirtc][DEBUG]', ...args);
  },
};

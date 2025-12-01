import pino from 'pino';
import { config } from '../config.js';

/**
 * Create a high-performance async logger with Pino
 * Pino is one of the fastest Node.js loggers with minimal overhead
 */
const logger = pino({
  level: config.debug ? 'debug' : 'info',

  // Use pino-pretty for development readability (disable in production for max performance)
  transport: config.debug ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false
    }
  } : undefined,

  // Custom formatters for better output
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },

  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Base properties for all logs
  base: {
    env: process.env.NODE_ENV || 'development'
  }
});

/**
 * Create a child logger with session context
 * @param {string} sessionId - Session identifier
 * @returns {import('pino').Logger}
 */
export function createSessionLogger(sessionId) {
  return logger.child({ sessionId });
}

/**
 * Log levels:
 * - trace: Very detailed debugging
 * - debug: Debugging information (hot path - use sparingly)
 * - info: General informational messages
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors
 */
export default logger;

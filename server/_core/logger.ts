/**
 * Advanced Logging System
 * Provides structured logging with multiple levels and outputs
 */

import { ENV } from "./env";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.FATAL]: "FATAL",
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "\x1b[36m", // Cyan
  [LogLevel.INFO]: "\x1b[32m", // Green
  [LogLevel.WARN]: "\x1b[33m", // Yellow
  [LogLevel.ERROR]: "\x1b[31m", // Red
  [LogLevel.FATAL]: "\x1b[35m", // Magenta
};

const RESET_COLOR = "\x1b[0m";

function getMinLogLevel(): LogLevel {
  const level = ENV.logLevel.toLowerCase();
  switch (level) {
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    case "fatal":
      return LogLevel.FATAL;
    default:
      return LogLevel.INFO;
  }
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private minLevel: LogLevel;
  private context?: string;

  constructor(context?: string) {
    this.minLevel = getMinLogLevel();
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return ENV.enableLogging && level >= this.minLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: any, error?: Error): string {
    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const color = LOG_LEVEL_COLORS[level];

    let formatted = `${color}[${timestamp}] [${levelName}]${RESET_COLOR}`;

    if (this.context) {
      formatted += ` [${this.context}]`;
    }

    formatted += ` ${message}`;

    if (data) {
      formatted += `\n${color}Data:${RESET_COLOR} ${JSON.stringify(data, null, 2)}`;
    }

    if (error) {
      formatted += `\n${color}Error:${RESET_COLOR} ${error.message}`;
      if (error.stack && this.minLevel <= LogLevel.DEBUG) {
        formatted += `\n${color}Stack:${RESET_COLOR}\n${error.stack}`;
      }
    }

    return formatted;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      message,
    };

    if (this.context) {
      entry.context = this.context;
    }

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, data, error);

    // Console output
    if (level >= LogLevel.ERROR) {
      console.error(formatted);
    } else if (level >= LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // TODO: Add file logging, remote logging (Sentry, etc.)
    // For production, you might want to send logs to a service like:
    // - Sentry for error tracking
    // - Datadog for monitoring
    // - CloudWatch for AWS
    // - etc.
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | any, data?: any): void {
    const err = error instanceof Error ? error : undefined;
    const errorData = error instanceof Error ? data : error;
    this.log(LogLevel.ERROR, message, errorData, err);
  }

  fatal(message: string, error?: Error | any, data?: any): void {
    const err = error instanceof Error ? error : undefined;
    const errorData = error instanceof Error ? data : error;
    this.log(LogLevel.FATAL, message, errorData, err);
  }

  /**
   * Create a child logger with a specific context
   */
  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext);
  }
}

// Export default logger instance
export const logger = new Logger();

// Export Logger class for direct use
export { Logger };

// Export function to create contextual loggers
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Export helper functions for quick logging
export const log = {
  debug: (message: string, data?: any) => logger.debug(message, data),
  info: (message: string, data?: any) => logger.info(message, data),
  warn: (message: string, data?: any) => logger.warn(message, data),
  error: (message: string, error?: Error | any, data?: any) => logger.error(message, error, data),
  fatal: (message: string, error?: Error | any, data?: any) => logger.fatal(message, error, data),
};

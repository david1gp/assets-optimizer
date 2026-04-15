export type LogLevel = 0 | 1 | 2 | 3

export interface Logger {
  readonly level: LogLevel
  isEnabled(level: LogLevel): boolean
  summary(message: string): void
  files(message: string): void
  cli(message: string): void
  verbose(message: string): void
  warn(message: string): void
  error(message: string): void
}

export function createLogger(logLevel: number | undefined): Logger {
  const level = normalizeLogLevel(logLevel)

  const log = (minimumLevel: LogLevel, message: string, write: (message: string) => void = console.log): void => {
    if (level >= minimumLevel) {
      write(message)
    }
  }

  return {
    level,
    isEnabled(minimumLevel) {
      return level >= minimumLevel
    },
    summary(message) {
      log(1, message)
    },
    files(message) {
      log(1, message)
    },
    cli(message) {
      log(2, message)
    },
    verbose(message) {
      log(3, message)
    },
    warn(message) {
      log(1, message, console.warn)
    },
    error(message) {
      log(1, message, console.error)
    },
  }
}

function normalizeLogLevel(logLevel: number | undefined): LogLevel {
  if (logLevel == null) {
    return 1
  }

  if (logLevel <= 0) {
    return 0
  }

  if (logLevel === 1) {
    return 1
  }

  if (logLevel === 2) {
    return 2
  }

  return 3
}

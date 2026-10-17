import * as winston from "winston";
import "winston-daily-rotate-file";
import { inspect } from "util";
import { Writable } from "stream";
import { toPlainValue } from "./utils/log.serialize";
import type { LogEntry, LoggerConfigOptions, LogInfo } from "./types";
import { LokiSinkManager } from "./loki/loki-sink-manger";

/**
 * Application logger with support for console output,
 * rotating log files, and optional Loki log shipping.
 *
 * @example
 * const logger = new Logger({
 *   level: "debug",
 *   context: "PaymentService",
 *   console: { enabled: true, format: "pretty" },
 *   file: { dirname: "./logs" },
 * });
 */
export class Logger {
  private readonly winstonLogger: winston.Logger;
  private context?: string;

  /**
   * Creates a new Logger instance.
   *
   * Configures console output, rotating file logging,
   * and optional Loki log shipping.
   *
   * Loggers with matching Loki configurations share
   * the same LokiSink instance.
   *
   * @param options - Logger configuration options.
   *
   * @example
   * const logger = new Logger({
   *   level: "info",
   *   context: "UserService",
   * });
   */
  public constructor(options: LoggerConfigOptions = {}) {
    this.context = options.context;

    const isProduction = options.env === "production";
    const consoleOptions = options.console;
    const fileOptions = options.file;

    const lokiSink = options.loki
      ? LokiSinkManager.getSink(options.loki)
      : undefined;

    // Structured JSON formatting for files and production console.
    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf((info) => {
        const log = info as LogInfo;

        const logEntry: LogEntry = {
          timestamp: log.timestamp,
          level: log.level!,
          context: log.context,
          method: log.method!,
          message: toPlainValue(log.message),
        };

        if (log.errorObject) {
          logEntry.errorObject = toPlainValue(log.errorObject);
        }

        if (log.trace || log.stack) {
          logEntry.stack = log.trace || log.stack;
        }

        const {
          timestamp,
          level,
          message,
          context,
          trace,
          stack,
          errorObject,
          method,
          ...rest
        } = info;

        if (Object.keys(rest).length > 0) {
          logEntry.metadata = toPlainValue(rest);
        }

        return JSON.stringify(logEntry);
      }),
    );

    // Human-readable console formatting.
    const prettyFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        ({ level, message, timestamp, context, trace, stack, ...meta }) => {
          const time = timestamp
            ? new Date(timestamp as string).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "";

          let formattedMessage = message;

          if (typeof message === "object" && message !== null) {
            formattedMessage =
              "\n" +
              inspect(message, {
                depth: null,
                colors: true,
                maxArrayLength: null,
                breakLength: 80,
                compact: false,
              });
          }

          let log = `${time} ${level}`;

          if (context) {
            log += ` [${context}]`;
          }

          log += ` ${formattedMessage}`;

          const { error, errorObject, method, ...restMeta } = meta;

          if (method) {
            log += `\n  ↳ Method: ${method}`;
          }

          if (errorObject) {
            log +=
              "\n  ↳ Error Object:\n" +
              inspect(errorObject, {
                depth: null,
                colors: true,
                maxArrayLength: null,
                breakLength: 80,
                compact: false,
              });
          }

          if (Object.keys(restMeta).length > 0) {
            log +=
              "\n  ↳ Context:\n" +
              inspect(restMeta, {
                depth: null,
                colors: true,
                maxArrayLength: null,
                breakLength: 80,
                compact: false,
              });
          }

          const stackTrace = trace || stack;

          if (stackTrace) {
            log += "\n  ↳ Stack Trace:\n" + stackTrace;
          }

          return log;
        },
      ),
    );

    // Forward log entries to Loki before JSON serialization.
    const lokiForwardFormat = winston.format((info) => {
      lokiSink?.push(info as LogInfo);
      return info;
    })();

    const transports: winston.transport[] = [];

    // Console output is enabled by default.
    if (consoleOptions?.enabled !== false) {
      const consoleFormat =
        consoleOptions?.format ?? (isProduction ? "json" : "pretty");

      transports.push(
        new winston.transports.Console({
          level: consoleOptions?.level ?? "silly",
          format: consoleFormat === "json" ? jsonFormat : prettyFormat,
        }),
      );
    }

    // Rotating file output is enabled by default.
    if (fileOptions?.enabled !== false) {
      transports.push(
        new winston.transports.DailyRotateFile({
          dirname: fileOptions?.dirname ?? "logs",
          filename: fileOptions?.filename ?? "application-%DATE%.log",
          datePattern: fileOptions?.datePattern ?? "YYYY-MM-DD",
          zippedArchive: fileOptions?.zippedArchive ?? true,
          maxSize: fileOptions?.maxSize ?? "20m",
          maxFiles: fileOptions?.maxFiles ?? "14d",
          level: fileOptions?.level ?? "info",
          format: jsonFormat,
        }),
      );
    }

    // Keep Winston's pipeline active for Loki-only logging.
    if (transports.length === 0 && lokiSink) {
      transports.push(
        new winston.transports.Stream({
          stream: new Writable({
            write(_chunk, _encoding, callback) {
              callback();
            },
          }),
        }),
      );
    }

    this.winstonLogger = winston.createLogger({
      level: options.level ?? "info",
      silent: transports.length === 0,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        lokiForwardFormat,
        winston.format.json(),
      ),
      transports,
    });
  }

  /**
   * Logs an informational message.
   *
   * @param message - Message or object to log.
   * @param context - Optional context overriding the default context.
   *
   * @example
   * logger.log("User created successfully", "UserService");
   */
  public log(message: any, context?: string): void {
    const logContext = context || this.context;
    this.winstonLogger.info(message, { context: logContext });
  }

  /**
   * Logs an error message with an optional stack trace.
   *
   * @param message - Error message or object to log.
   * @param trace - Optional stack trace or error details.
   * @param context - Optional context overriding the default context.
   *
   * @example
   * logger.error("Failed to create user", error.stack, "UserService");
   */
  public error(message: any, trace?: string, context?: string): void {
    const logContext = context || this.context;

    this.winstonLogger.error(message, {
      trace,
      context: logContext,
    });
  }

  /**
   * Logs a warning message.
   *
   * @param message - Warning message or object to log.
   * @param context - Optional context overriding the default context.
   *
   * @example
   * logger.warn("API rate limit approaching", "ApiService");
   */
  public warn(message: any, context?: string): void {
    const logContext = context || this.context;

    this.winstonLogger.warn(message, {
      context: logContext,
    });
  }

  /**
   * Logs a debugging message.
   *
   * Messages are emitted only when the configured
   * logging levels permit debug output.
   *
   * @param message - Debug message or object to log.
   * @param context - Optional context overriding the default context.
   *
   * @example
   * logger.debug({ userId: 123 }, "AuthService");
   */
  public debug(message: any, context?: string): void {
    const logContext = context || this.context;

    this.winstonLogger.debug(message, {
      context: logContext,
    });
  }

  /**
   * Logs a verbose diagnostic message.
   *
   * @param message - Verbose message or object to log.
   * @param context - Optional context overriding the default context.
   *
   * @example
   * logger.verbose("Connecting to database", "DatabaseService");
   */
  public verbose(message: any, context?: string): void {
    const logContext = context || this.context;

    this.winstonLogger.verbose(message, {
      context: logContext,
    });
  }

  /**
   * Sets the default context for subsequent log entries.
   *
   * Individual log calls can override this context.
   *
   * @param context - Default context name.
   *
   * @example
   * logger.setContext("PaymentService");
   */
  public setContext(context: string): void {
    this.context = context;
  }

  /**
   * Logs a service error with its method name, stack trace,
   * original error object, and additional metadata.
   *
   * @param method - Name of the method where the error occurred.
   * @param error - The caught error or unknown thrown value.
   * @param additionalContext - Additional metadata to attach.
   *
   * @example
   * logger.logServiceError("createPayment", error, {
   *   paymentId: "pay_123",
   *   retryCount: 2,
   * });
   */
  public logServiceError(
    method: string,
    error: unknown,
    additionalContext: Record<string, any> = {},
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const stack = error instanceof Error ? error.stack : undefined;

    this.winstonLogger.error(`Error in ${method}: ${errorMessage}`, {
      context: this.context,
      method,
      stack,
      errorObject: error,
      ...additionalContext,
    });
  }

  /**
   * Logs an object with an optional label and severity level.
   *
   * Objects are displayed using Node.js inspection
   * when pretty console formatting is enabled.
   *
   * @param obj - Object to log.
   * @param label - Optional label displayed before the object.
   * @param level - Logging severity.
   * @default level "info"
   *
   * @example
   * logger.logObject({ id: 123, name: "John" }, "User", "debug");
   */
  public logObject(
    obj: any,
    label?: string,
    level: "info" | "debug" | "warn" | "error" = "info",
  ): void {
    const message = label ? `${label}:` : "Object:";

    this.winstonLogger[level](message, {
      context: this.context,
      data: obj,
    });
  }

  /**
   * Logs a titled section surrounded by visual separators.
   *
   * Useful for distinguishing application startup phases,
   * operations, or debugging sections.
   *
   * @param title - Section title.
   * @param level - Logging severity.
   * @default level "info"
   *
   * @example
   * logger.logSection("Application Startup");
   */
  public logSection(
    title: string,
    level: "info" | "debug" | "warn" = "info",
  ): void {
    const separator = "─".repeat(50);

    this.winstonLogger[level](`\n${separator}\n${title}\n${separator}`, {
      context: this.context,
    });
  }

  /**
   * Logs a fatal error.
   *
   * @param message - Fatal error message or object.
   * @param context - Optional context overriding the default context.
   */
  public fatal(message: any, context?: string): void {
    const logContext = context || this.context;

    this.winstonLogger.error(message, {
      context: logContext,
      fatal: true,
    });
  }
}

import type { knownFieldsArray } from "./loki/defaults";

export type BufferedEntry = {
  labels: LokiLabels;
  timestampNs: string;
  line: string;
};

export type LokiStream = {
  stream: LokiLabels;
  values: [string, string][];
};

export type LokiKnownFields = (typeof knownFieldsArray)[number];

type BasicAuth =
  | { username: string; password: string; credentials?: never }
  | { credentials: `${string}:${string}`; username?: never; password?: never };

type AuthConfig =
  | { auth: false; authType?: never }
  | ({ auth: true } & (
      | ({ authType: "basic" } & BasicAuth)
      | { authType: "token"; token: string }
    ));

// What the USER passes in. Every optional field also accepts `undefined`,
// because exactOptionalPropertyTypes is on: without it, passing
// `orgId: process.env.LOKI_ORG` would be a type error.
export type LokiConfigOptions = {
  url: string | URL;
  appLabel: string;
  jobLabel: string;
  orgId?: string | undefined;
  deployEnv?:
    | "development"
    | "production"
    | "staging"
    | (string & {})
    | undefined;
  /** How often the buffer is sent, in ms. Default 1000. */
  flushIntervalMs?: number | undefined;
  /** Buffered lines that trigger an early send, and the max per request. Default 500. */
  maxBufferedEntries?: number | undefined;
  /** Hard cap on lines held in memory. Oldest are dropped past it. Default 5000. */
  maxBufferSize?: number | undefined;
  /** Per-request timeout in ms. Default 5000. */
  requestTimeoutMs?: number | undefined;
  /** Extra attempts after a failed send. 0 disables retries. Default 2. */
  maxRetries?: number | undefined;
  /** Delay before the first retry in ms, doubling each attempt. Default 500. */
  retryBackoffMs?: number | undefined;
} & AuthConfig;

export type LokiLogInfo = {
  [K in LokiKnownFields]?: K extends "timestamp"
    ? string | number | Date
    : K extends "level" | "context" | "message" | "method" | "trace" | "stack"
      ? string
      : unknown;
} & {
  [key: string]: unknown;
};

export type LokiHeaders = {
  "Content-Type": string;
  Authorization?: string;
  "X-Scope-OrgID"?: string;
};

export type LokiLabels = {
  job: string;
  app_name: string;
  environment: string;
  level: string;
  context?: string;
};

export type LogEntry = {
  timestamp: unknown;
  level: string;
  context: unknown;
  method: string;
  message: unknown;
  errorObject?: unknown;
  stack?: unknown;
  metadata?: unknown;
};

export type LogInfo = LokiLogInfo;

/**
 * Configuration options for the Logger instance.
 *
 * Controls logging levels, default context, console output,
 * rotating file output, and optional Loki log shipping.
 */
export type LoggerConfigOptions = {
  /**
   * Minimum logging level for the logger.
   * @default "info"
   */
  level?: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";

  /**
   * Default context attached to log entries.
   * Can be overridden per log call.
   */
  context?: string;

  /**
   * Configuration for console logging.
   */
  console?: {
    /**
     * Whether console logging is enabled.
     * @default true
     */
    enabled?: boolean;

    /**
     * Minimum logging level for console output.
     * @default "silly"
     */
    level?: LoggerConfigOptions["level"];

    /**
     * Console output format.
     *
     * - `pretty`: Human-readable, colorized output.
     * - `json`: Structured JSON output.
     *
     * @default "pretty" in development, "json" in production
     */
    format?: "pretty" | "json";
  };

  /**
   * Configuration for rotating file logging.
   */
  file?: {
    /**
     * Whether file logging is enabled.
     * @default true
     */
    enabled?: boolean;

    /**
     * Minimum logging level for file output.
     * @default "info"
     */
    level?: LoggerConfigOptions["level"];

    /**
     * Directory where log files are stored.
     * @default "logs"
     * @example "./storage/logs"
     */
    dirname?: string;

    /**
     * File path pattern for rotating log files.
     * Use `%DATE%` as the date placeholder.
     * @default "logs/application-%DATE%.log"
     */
    filename?: string;

    /**
     * Date format used for log file rotation.
     * @default "YYYY-MM-DD"
     */
    datePattern?: string;

    /**
     * Maximum size of each log file before rotation.
     * @default "20m"
     */
    maxSize?: string;

    /**
     * Maximum number of rotated files or retention duration.
     * @example "14d"
     * @default "14d"
     */
    maxFiles?: string;

    /**
     * Whether rotated log files should be compressed.
     * @default true
     */
    zippedArchive?: boolean;
  };

  /**
   * Optional Loki log shipping configuration.
   *
   * When omitted, Loki shipping is disabled.
   * Loggers with matching Loki configurations can share
   * the same LokiSink instance.
   */
  loki?: LokiConfigOptions;

  /**
   * Application deployment environment.
   *
   * Determines the default console output format:
   * - "production": JSON
   * - Other environments: Pretty
   *
   * @default "development"
   */
  env?: "development" | "production" | "test" | (string & {});
};

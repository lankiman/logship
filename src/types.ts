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

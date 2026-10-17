// Defaults used when the user does not pass an option.

/** How often the buffer is sent. */
export const FLUSH_INTERVAL_MS = 1000;
/** Buffered lines that trigger an early send. Also the max lines per request. */
export const MAX_BUFFERED_ENTRIES = 500;
/** Hard cap on lines kept in memory. Past it, the OLDEST lines are dropped. */
export const MAX_BUFFER_SIZE = 5000;
/** Per-request timeout. */
export const REQUEST_TIMEOUT_MS = 5000;
/** Extra attempts after a failed send (transient failures only). */
export const MAX_RETRIES = 2;
/** Delay before the first retry. It doubles on every further attempt. */
export const RETRY_BACKOFF_MS = 500;
/** The wait between attempts never grows past this while Loki is down. */
export const MAX_BACKOFF_MS = 30_000;

// `as const` keeps the exact strings, so LokiKnownFields is a union of them
// instead of plain `string`.
export const knownFieldsArray = [
  "timestamp",
  "level",
  "message",
  "context",
  "method",
  "trace",
  "stack",
  "errorObject",
] as const;

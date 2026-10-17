/**
 * Best-effort Loki log shipper.
 *
 * Every log entry is buffered in memory and sent to a Loki-compatible
 * `/loki/api/v1/push` endpoint on a fixed interval (or once the buffer is
 * full). It never slows down or crashes the application.
 *
 * When Loki cannot be reached:
 *  - transient failures (network errors, timeouts, 408, 429, 5xx) are retried
 *    with exponential backoff;
 *  - if they still fail, the lines stay buffered and are tried again later,
 *    up to `maxBufferSize` lines (the OLDEST are dropped past that);
 *  - permanent failures (other 4xx, e.g. wrong credentials) are not retried,
 *    and that batch is dropped, because it would fail the same way every time.
 *
 * A request that timed out may still have reached Loki, so a retry can
 * occasionally deliver the same lines twice.
 *
 * If the URL or auth settings are invalid, the sink disables itself: no timer,
 * no network calls, one warning.
 */
import type {
  BufferedEntry,
  LokiConfigOptions,
  LokiHeaders,
  LokiLabels,
  LokiLogInfo,
  LokiStream,
} from "../types";
import {
  LokiHttpError,
  ShipFailure,
  buildLogLine,
  describeShipError,
  isRetryable,
  nonNegativeInt,
  parseHttpUrl,
  positiveInt,
  readBodySnippet,
  sleep,
  toNanoseconds,
} from "../utils/loki.helpers";
import {
  FLUSH_INTERVAL_MS,
  MAX_BACKOFF_MS,
  MAX_BUFFERED_ENTRIES,
  MAX_BUFFER_SIZE,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
} from "./defaults";

// The user's options, with every defaulted field guaranteed present,
// so the class never has to deal with `undefined` for them.
type ActiveConfig = LokiConfigOptions & {
  flushIntervalMs: number;
  maxBufferedEntries: number;
  maxBufferSize: number;
  requestTimeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
};

export class LokiSink {
  private initialized = false;
  private enabled = false;
  private authHeader?: string | undefined;
  private target = ""; // the validated URL we POST to
  private displayUrl = ""; // same, minus credentials/query, safe to print
  private buffer: BufferedEntry[] = [];
  private config: ActiveConfig;
  private timer?: NodeJS.Timeout | undefined;

  // Runtime state (not options)
  private current?: Promise<void> | undefined; // the send loop that is running now
  private consecutiveFailures = 0;
  private retryNotBefore = 0; // do not try again before this time
  private droppedForSpace = 0;
  private lastReportAt = 0;

  constructor(options: LokiConfigOptions) {
    // Defaults are applied here, once.
    const maxBufferedEntries = positiveInt(
      options.maxBufferedEntries,
      MAX_BUFFERED_ENTRIES,
    );

    this.config = {
      ...options,
      flushIntervalMs: positiveInt(options.flushIntervalMs, FLUSH_INTERVAL_MS),
      maxBufferedEntries,
      // The cap can never be smaller than one batch.
      maxBufferSize: Math.max(
        positiveInt(options.maxBufferSize, MAX_BUFFER_SIZE),
        maxBufferedEntries,
      ),
      requestTimeoutMs: positiveInt(
        options.requestTimeoutMs,
        REQUEST_TIMEOUT_MS,
      ),
      maxRetries: nonNegativeInt(options.maxRetries, MAX_RETRIES),
      retryBackoffMs: positiveInt(options.retryBackoffMs, RETRY_BACKOFF_MS),
    };
  }

  private createAuthHeader(config: LokiConfigOptions): string | undefined {
    if (!config.auth) return undefined;

    if (!config.authType) {
      console.warn("[logship] Authentication type is required");
      return undefined;
    }

    switch (config.authType) {
      case "basic": {
        const credentials =
          "credentials" in config
            ? config.credentials
            : `${config.username}:${config.password}`;

        // Split at the FIRST colon only. A password may itself contain colons.
        const separator = credentials?.indexOf(":") ?? -1;

        if (
          separator <= 0 ||
          !credentials?.slice(separator + 1) ||
          !credentials.slice(0, separator).trim()
        ) {
          console.warn("[logship] Invalid Basic Auth credentials");
          return undefined;
        }

        return `Basic ${Buffer.from(credentials).toString("base64")}`;
      }

      case "token": {
        if (typeof config.token !== "string" || !config.token.trim()) {
          console.warn("[logship] Bearer token is required");
          return undefined;
        }

        return `Bearer ${config.token}`;
      }

      default:
        console.warn("[logship] Unsupported authentication type");
        return undefined;
    }
  }

  /**
   * Validates the config on first use. Nothing is started (no timer, no
   * network) unless every check passes.
   */
  private init(): void {
    this.initialized = true;

    const url = this.config.url ? parseHttpUrl(this.config.url) : undefined;
    if (!url) {
      this.enabled = false;
      console.warn(
        "[logship] log shipping disabled: LOKI URL is invalid or is not set",
      );
      return;
    }

    // Only validate auth when the user asked for it. `auth: false` is fine.
    if (this.config.auth) {
      this.authHeader = this.createAuthHeader(this.config);

      if (!this.authHeader) {
        this.enabled = false;
        console.warn("[logship] log shipping disabled: invalid auth headers");
        return;
      }
    }

    this.target = url.href;
    this.displayUrl = `${url.origin}${url.pathname}`; // never print credentials
    this.enabled = true;
    console.log(`[logship] log shipping enabled -> ${this.displayUrl}`);

    this.timer = setInterval(
      () => void this.flush(),
      this.config.flushIntervalMs,
    );
    // Never keep the process alive just for log shipping.
    this.timer.unref?.();

    // When the process ends naturally, make one last attempt to send what is left.
    process.once("beforeExit", () => void this.close());
  }

  push(info: LokiLogInfo): void {
    // Logging must never throw into the application.
    try {
      if (!this.initialized) {
        this.init();
      }
      if (!this.enabled) {
        return;
      }

      const environment = this.config.deployEnv || "production";

      const labels: LokiLabels = {
        job: this.config.jobLabel,
        app_name: this.config.appLabel,
        environment,
        level: typeof info.level === "string" ? info.level : "info",
      };
      if (typeof info.context === "string") {
        labels.context = info.context;
      }

      this.buffer.push({
        labels,
        timestampNs: toNanoseconds(info.timestamp),
        line: buildLogLine(info),
      });
      this.trim();

      if (this.buffer.length >= this.config.maxBufferedEntries) {
        void this.flush();
      }
    } catch (error) {
      this.report(`could not buffer a log line: ${this.messageOf(error)}`);
    }
  }

  /**
   * Stops the timer and makes one last attempt to send what is buffered.
   * Call it from your app's shutdown hook. It never retries, so it cannot
   * hold up shutdown for long.
   */
  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (!this.enabled) return;

    await this.current; // let a send that is already running finish
    if (this.buffer.length > 0) {
      this.current = this.drain(0).finally(() => {
        this.current = undefined;
      });
      await this.current;
    }
  }

  /** Keeps memory bounded: past the cap, the OLDEST lines are dropped. */
  private trim(): void {
    const excess = this.buffer.length - this.config.maxBufferSize;
    if (excess > 0) {
      this.buffer.splice(0, excess);
      this.droppedForSpace += excess;
      this.report(
        `buffer full (${this.config.maxBufferSize} lines): ${this.droppedForSpace} oldest log lines dropped so far`,
      );
    }
  }

  private flush(): Promise<void> {
    if (this.current) return this.current; // already sending
    if (
      !this.enabled ||
      this.buffer.length === 0 ||
      Date.now() < this.retryNotBefore // still waiting after a failure
    ) {
      return Promise.resolve();
    }

    this.current = this.drain(this.config.maxRetries).finally(() => {
      this.current = undefined;
    });
    return this.current;
  }

  /** Sends everything buffered, one batch at a time. It never rejects. */
  private async drain(retries: number): Promise<void> {
    try {
      while (this.buffer.length > 0) {
        const batch = this.buffer.splice(0, this.config.maxBufferedEntries);

        try {
          await this.send(batch, retries);
          this.consecutiveFailures = 0;
          this.retryNotBefore = 0;
        } catch (error) {
          const message = this.messageOf(error);

          if (error instanceof ShipFailure && !error.retryable) {
            // Retrying cannot help (e.g. 400, 401). Drop this batch, carry on.
            this.report(
              `dropped ${batch.length} log lines (not retryable): ${message}`,
            );
            continue;
          }

          // Transient: put the lines back at the front and wait before trying again.
          this.buffer.unshift(...batch);
          this.trim();
          this.consecutiveFailures++;
          const wait = Math.min(
            this.config.retryBackoffMs * 2 ** this.consecutiveFailures,
            MAX_BACKOFF_MS,
          );
          this.retryNotBefore = Date.now() + wait;
          this.report(
            `could not reach Loki at ${this.displayUrl}; keeping ${this.buffer.length} lines to retry: ${message}`,
          );
          return;
        }
      }
    } catch (error) {
      this.report(`unexpected error while sending: ${this.messageOf(error)}`);
    }
  }

  /** One batch, with up to `retries` extra attempts for transient failures. */
  private async send(batch: BufferedEntry[], retries: number): Promise<void> {
    // Group entries that share identical labels into one stream.
    const streams = new Map<string, LokiStream>();
    for (const entry of batch) {
      const key = JSON.stringify(entry.labels);
      let stream = streams.get(key);
      if (!stream) {
        stream = { stream: entry.labels, values: [] };
        streams.set(key, stream);
      }
      stream.values.push([entry.timestampNs, entry.line]);
    }
    const body = JSON.stringify({ streams: Array.from(streams.values()) });

    for (let attempt = 0; ; attempt++) {
      const startedAt = Date.now();
      try {
        await this.post(body);
        return;
      } catch (error) {
        const failure = new ShipFailure(
          describeShipError(error, Date.now() - startedAt).message,
          isRetryable(error),
        );
        if (!failure.retryable || attempt >= retries) {
          throw failure;
        }
        await sleep(this.config.retryBackoffMs * 2 ** attempt);
      }
    }
  }

  private async post(body: string): Promise<void> {
    const headers: LokiHeaders = { "Content-Type": "application/json" };
    if (this.authHeader) {
      headers.Authorization = this.authHeader;
    }
    if (this.config.orgId) {
      headers["X-Scope-OrgID"] = this.config.orgId;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );
    timeout.unref?.();

    try {
      const response = await fetch(this.target, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new LokiHttpError(
          response.status,
          response.statusText,
          await readBodySnippet(response),
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /** Prints to stderr, at most once per request-timeout window, so failures cannot flood the logs. */
  private report(message: string): void {
    const now = Date.now();
    if (now - this.lastReportAt < this.config.requestTimeoutMs) return;
    this.lastReportAt = now;
    console.error(`[logship] ${message}`);
  }
}

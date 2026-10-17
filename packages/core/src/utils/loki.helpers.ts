import { knownFieldsArray } from "../loki/defaults";
import type { LokiConfigOptions, LokiLogInfo } from "../types";
import { stringifyLogValue } from "./log.serialize";

const KNOWN_FIELDS = new Set<string>(knownFieldsArray);

/** Loki wants nanoseconds since 1970, as a string. Handles Date, number (ms) and string. */
export function toNanoseconds(timestamp: unknown): string {
  let ms = Date.now();

  if (timestamp instanceof Date) {
    const t = timestamp.getTime();
    if (!Number.isNaN(t)) ms = t;
  } else if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    ms = timestamp;
  } else if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) ms = parsed;
  }

  // BigInt: a nanosecond timestamp is too big for a normal number to hold exactly.
  // trunc: BigInt() throws on a fractional number such as 1.5.
  return (BigInt(Math.trunc(ms)) * 1_000_000n).toString();
}

export function buildLogLine(info: LokiLogInfo): string {
  const context = typeof info.context === "string" ? info.context : "";
  const rawMessage = info.message;
  const message =
    typeof rawMessage === "string" ? rawMessage : stringifyLogValue(rawMessage);

  let line = context ? `[${context}] ${message}` : message;

  const extras: string[] = [];
  if (info.method) {
    extras.push(`method=${stringifyLogValue(info.method)}`);
  }
  for (const [key, value] of Object.entries(info)) {
    if (!KNOWN_FIELDS.has(key)) {
      extras.push(`${key}=${stringifyLogValue(value)}`);
    }
  }
  if (extras.length > 0) {
    line += ` ${extras.join(" ")}`;
  }

  const stack = info.trace ?? info.stack;
  if (stack) {
    line += `\n${stringifyLogValue(stack)}`;
  }
  if (info.errorObject) {
    line += `\n${stringifyLogValue(info.errorObject)}`;
  }

  return line;
}

export async function readBodySnippet(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "<unreadable body>";
  }
}

function errorCauseCode(value: unknown): string {
  if (value && typeof value === "object" && "code" in value) {
    const code = (value as { code?: unknown }).code;
    if (typeof code === "string") {
      return code;
    }
  }
  return "";
}

export function describeShipError(error: unknown, elapsedMs: number): Error {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error.cause : undefined;
  const causeName =
    cause instanceof Error ? cause.name : cause ? typeof cause : "";
  const code = errorCauseCode(cause) || errorCauseCode(error);
  const causeText =
    causeName || code ? ` cause=${causeName}${code ? `/${code}` : ""}` : "";
  return new Error(`${name}: ${message}${causeText} after ${elapsedMs}ms`);
}

/** Loki answered, but with an error status. */
export class LokiHttpError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string, body: string) {
    super(`Loki responded ${status} ${statusText} body="${body}"`);
    this.name = "LokiHttpError";
    this.status = status;
  }
}

/** A failed send, carrying whether trying again could help. */
export class ShipFailure extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ShipFailure";
    this.retryable = retryable;
  }
}

/**
 * Worth retrying: network errors, timeouts, 408, 429 and 5xx.
 * Not worth retrying: other 4xx (bad request, wrong credentials). They fail the same way every time.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof LokiHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return true;
}

/** Whole number >= 1, otherwise the fallback. */
export function positiveInt(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.floor(value))
    : fallback;
}

/** Whole number >= 0 (0 is allowed), otherwise the fallback. */
export function nonNegativeInt(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/** Returns a URL only for http(s). Accepts a string or a URL object. */
export function parseHttpUrl(input: string | URL): URL | undefined {
  try {
    const url = new URL(input instanceof URL ? input.href : input.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeLokiConfig(config: LokiConfigOptions) {
  return {
    url: config.url?.toString(),
    orgId: config.orgId,
    deployEnv: config.deployEnv,
    auth: config.auth,
    authType: config.auth ? config.authType : undefined,
    credentials:
      config.auth && config.authType === "basic"
        ? "credentials" in config
          ? config.credentials
          : `${config.username}:${config.password}`
        : undefined,
    token:
      config.auth && config.authType === "token" ? config.token : undefined,
  };
}

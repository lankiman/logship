/**
 * Turns any logged value into a plain, JSON-safe structure.
 *
 * `JSON.stringify` alone loses useful data: `Error` instances become `{}` (their
 * `message`/`stack` are non-enumerable), `Date`/`Map`/`Set` collapse, and
 * circular references throw. This walks the value once and produces something
 * that always serializes, so logs never show an empty object.
 */
export function toPlainValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    const plain: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    if (value.cause !== undefined) {
      plain["cause"] = toPlainValue(value.cause, seen);
    }

    for (const [key, nested] of Object.entries(value)) {
      if (!(key in plain)) {
        plain[key] = toPlainValue(nested, seen);
      }
    }

    return plain;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => toPlainValue(item, seen));
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, nested]) => [
        String(key),
        toPlainValue(nested, seen),
      ]),
    );
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((item) => toPlainValue(item, seen));
  }

  const plain: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    plain[key] = toPlainValue(nested, seen);
  }

  return plain;
}

/**
 * Renders a value for a single log line. `Error` keeps its stack for
 * readability; everything else is serialized as JSON.
 */
export function stringifyLogValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(toPlainValue(value));
  } catch {
    return String(value);
  }
}

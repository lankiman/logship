/**
 * Injection token for the complete Logship module configuration.
 */
export const LOGSHIP_OPTIONS = Symbol("@logship/nestjs:options");

/**
 * Injection token for the default core logger configuration.
 */
export const LOGSHIP_LOGGER_OPTIONS = Symbol("@logship/nestjs:logger-options");

/**
 * Returns a stable injection token for a named Logship logger.
 *
 * Names are isolated from ordinary string-based provider tokens
 * using a Logship-specific namespace.
 *
 * The same name always produces the same token.
 *
 * @param name - Unique logger name.
 *
 * @example
 * getLogshipLoggerToken("payments");
 */
export function getLogshipLoggerToken(name: string): symbol {
  return Symbol.for(`@logship/nestjs:logger:${name}`);
}

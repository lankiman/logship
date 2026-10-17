import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "logship";

import type { LoggerConfigOptions } from "logship";

import { LOGSHIP_OPTIONS } from "./logger.constants.js";

import type {
  LogshipCreateLoggerOptions,
  LogshipModuleOptions,
} from "./types.js";

/**
 * Factory for creating independently configured Logship loggers.
 *
 * Supports default configuration inheritance and named loggers.
 */
@Injectable()
export class LogshipLoggerFactory {
  public constructor(
    @Inject(LOGSHIP_OPTIONS)
    private readonly options: LogshipModuleOptions,
  ) {}

  /**
   * Resolves logger configuration with optional inheritance.
   *
   * Console and file settings are merged individually.
   * Loki configuration is replaced as a complete unit to
   * preserve its authentication type constraints.
   *
   * @param overrides - Logger-specific configuration.
   * @param inheritDefaults - Whether to inherit module defaults.
   */
  public resolve(
    overrides: LoggerConfigOptions = {},
    inheritDefaults = true,
  ): LoggerConfigOptions {
    if (!inheritDefaults) {
      return { ...overrides };
    }

    const defaults = this.options.logger ?? {};

    return {
      ...defaults,
      ...overrides,

      console: {
        ...defaults.console,
        ...overrides.console,
      },

      file: {
        ...defaults.file,
        ...overrides.file,
      },

      loki: overrides.loki ?? defaults.loki,
    };
  }
  /**
   * Creates an independent core logger instance.
   *
   * @param options - Logger configuration and inheritance settings.
   *
   * @example
   * const logger = factory.create({
   *   inheritDefaults: true,
   *   logger: {
   *     context: "PaymentService",
   *     level: "debug",
   *   },
   * });
   */
  public create(options: LogshipCreateLoggerOptions = {}): Logger {
    const config = this.resolve(
      options.logger,
      options.inheritDefaults ?? true,
    );

    return new Logger(config);
  }

  /**
   * Creates a logger using a named configuration.
   *
   * @param name - Registered logger name.
   * @throws Error if the logger name is not registered.
   *
   * @example
   * const logger = factory.createNamed("payments");
   */
  public createNamed(name: string): Logger {
    const named = this.options.loggers?.[name];

    if (!named) {
      throw new Error(`Logship logger "${name}" is not configured.`);
    }

    return this.create({
      logger: named.logger,
      inheritDefaults: named.inheritDefaults ?? true,
    });
  }
}

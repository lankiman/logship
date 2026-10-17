import { Inject, Injectable, type LoggerService } from "@nestjs/common";

import { Logger } from "logship";
import type { LoggerConfigOptions } from "logship";

import { LOGSHIP_LOGGER_OPTIONS } from "./logger.constants.js";

/**
 * NestJS integration for the Logship core logger.
 *
 * Inherits all logging functionality from @logship/core,
 * including console logging, file rotation, Loki shipping,
 * context management, and structured logging.
 *
 * Provider scope is configured through LogshipModule.forRoot()
 * or LogshipModule.forRootAsync().
 *
 * @example
 * @Injectable()
 * export class UsersService {
 *   constructor(
 *     private readonly logger: LogshipLoggerService,
 *   ) {
 *     this.logger.setContext(UsersService.name);
 *   }
 * }
 */
@Injectable()
export class LogshipLoggerService extends Logger implements LoggerService {
  /**
   * Creates a Logship logger using the default configuration
   * registered by LogshipModule.
   *
   * @param options - Default core logger configuration.
   */
  public constructor(
    @Inject(LOGSHIP_LOGGER_OPTIONS)
    options: LoggerConfigOptions,
  ) {
    super(options);
  }
}

import {
  Module,
  Scope,
  type DynamicModule,
  type Provider,
} from "@nestjs/common";

import type { LoggerConfigOptions } from "logship";

import { LogshipLoggerService } from "./logger.service.js";
import { LogshipLoggerFactory } from "./logger.factory.js";

import {
  LOGSHIP_OPTIONS,
  LOGSHIP_LOGGER_OPTIONS,
  getLogshipLoggerToken,
} from "./logger.constants.js";

import type {
  LogshipModuleOptions,
  LogshipModuleAsyncOptions,
} from "./types.js";

/**
 * NestJS module for configuring and injecting Logship loggers.
 *
 * Supports synchronous and asynchronous configuration,
 * named loggers, configurable provider scopes, and
 * independent logger instances.
 *
 * The module is global by default.
 */
@Module({})
export class LogshipModule {
  /**
   * Registers Logship using synchronous configuration.
   *
   * @param options - Module and logger configuration.
   *
   * @example
   * LogshipModule.forRoot({
   *   logger: {
   *     level: "debug",
   *   },
   * });
   */
  public static forRoot(options: LogshipModuleOptions = {}): DynamicModule {
    return this.createModule({
      isGlobal: options.isGlobal,
      scope: options.scope,
      loggerNames: Object.keys(options.loggers ?? {}),
      optionsProvider: {
        provide: LOGSHIP_OPTIONS,
        useValue: options,
      },
    });
  }

  /**
   * Registers Logship using an asynchronous configuration factory.
   *
   * Named logger names must be declared in loggerNames
   * because NestJS registers provider tokens before the
   * asynchronous configuration factory resolves.
   *
   * @param options - Asynchronous module configuration.
   */
  public static forRootAsync(
    options: LogshipModuleAsyncOptions,
  ): DynamicModule {
    return this.createModule({
      isGlobal: options.isGlobal,
      scope: options.scope,
      imports: options.imports,
      loggerNames: options.loggerNames ?? [],
      optionsProvider: {
        provide: LOGSHIP_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
    });
  }

  /**
   * Builds the dynamic module and registers its providers.
   *
   * Logger scope defaults to transient, while configuration
   * and factory providers remain singleton.
   */
  private static createModule(config: {
    isGlobal?: boolean;
    scope?: Scope;
    imports?: DynamicModule["imports"];
    loggerNames: string[];
    optionsProvider: Provider;
  }): DynamicModule {
    const scope = config.scope ?? Scope.TRANSIENT;

    const loggerOptionsProvider: Provider = {
      provide: LOGSHIP_LOGGER_OPTIONS,
      useFactory: (options: LogshipModuleOptions): LoggerConfigOptions =>
        options.logger ?? {},
      inject: [LOGSHIP_OPTIONS],
    };

    const defaultLoggerProvider: Provider = {
      provide: LogshipLoggerService,
      useClass: LogshipLoggerService,
      scope,
    };

    const namedLoggerProviders: Provider[] = config.loggerNames.map((name) => ({
      provide: getLogshipLoggerToken(name),
      scope,
      useFactory: (factory: LogshipLoggerFactory) => factory.createNamed(name),
      inject: [LogshipLoggerFactory],
    }));

    return {
      module: LogshipModule,
      global: config.isGlobal ?? true,
      imports: config.imports ?? [],
      providers: [
        config.optionsProvider,
        loggerOptionsProvider,
        LogshipLoggerFactory,
        defaultLoggerProvider,
        ...namedLoggerProviders,
      ],
      exports: [
        LogshipLoggerService,
        LogshipLoggerFactory,
        ...config.loggerNames.map(getLogshipLoggerToken),
      ],
    };
  }
}

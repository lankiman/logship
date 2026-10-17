import type { FactoryProvider, ModuleMetadata, Scope } from "@nestjs/common";

import type { LoggerConfigOptions } from "logship";

/**
 * Configuration for a named Logship logger.
 */
export type LogshipNamedLoggerOptions = {
  /**
   * Logger-specific configuration.
   */
  logger?: LoggerConfigOptions;

  /**
   * Whether to inherit the default logger configuration.
   *
   * @default true
   */
  inheritDefaults?: boolean;
};

/**
 * Configuration for the Logship NestJS module.
 */
export type LogshipModuleOptions = {
  /**
   * Whether the module is globally available.
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Dependency injection scope for logger instances.
   *
   * @default Scope.TRANSIENT
   */
  scope?: Scope;

  /**
   * Default logger configuration.
   */
  logger?: LoggerConfigOptions;

  /**
   * Additional named logger configurations.
   */
  loggers?: Record<string, LogshipNamedLoggerOptions>;
};

/**
 * Options for creating an independent logger instance.
 */
export type LogshipCreateLoggerOptions = {
  /**
   * Logger configuration overrides.
   */
  logger?: LoggerConfigOptions;

  /**
   * Whether to inherit the default logger configuration.
   *
   * @default true
   */
  inheritDefaults?: boolean;
};

/**
 * Configuration for asynchronous Logship module initialization.
 */
export type LogshipModuleAsyncOptions = {
  /**
   * Whether the module is globally available.
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Dependency injection scope for logger instances.
   *
   * @default Scope.TRANSIENT
   */
  scope?: Scope;

  /**
   * Modules providing dependencies for the configuration factory.
   */
  imports?: ModuleMetadata["imports"];

  /**
   * Dependencies injected into the configuration factory.
   */
  inject?: FactoryProvider["inject"];

  /**
   * Factory responsible for resolving Logship configuration.
   */
  useFactory: (
    ...args: any[]
  ) => LogshipModuleOptions | Promise<LogshipModuleOptions>;

  /**
   * Names of loggers that will be registered for injection.
   *
   * Required when using named loggers with forRootAsync().
   */
  loggerNames?: string[];
};

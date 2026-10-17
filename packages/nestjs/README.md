# @logship/nestjs

**Logship for NestJS** — structured application logging with dependency injection, configurable log levels, rotating files, and Grafana Loki integration.

`@logship/nestjs` integrates Logship with NestJS, allowing you to configure logging once and inject loggers into your services, controllers, guards, interceptors, and other providers.

It is built on [`logship`](../core/README.md), which handles the underlying logging functionality.

## Features

- Native NestJS dependency injection
- Simple module configuration with `forRoot()`
- Asynchronous configuration with `forRootAsync()`
- Injectable `LogshipLogger`
- Named loggers with independent configuration
- `@InjectLogshipLogger()` decorator
- Configurable provider scopes
- Global module support
- Console logging
- Rotating log files
- Grafana Loki integration
- Shared Loki sinks across compatible logger instances
- TypeScript configuration validation

## Installation

Install the package using your preferred package manager.

### npm

```bash
npm install @logship/nestjs
```

### pnpm

```bash
pnpm add @logship/nestjs
```

### yarn

```bash
yarn add @logship/nestjs
```

Your application must also have compatible versions of `@nestjs/common` and `@nestjs/core` installed.

The package uses `logship` internally, so you do not need to configure a separate core logger for normal NestJS usage.

If you want to import the core `Logger` class or its types directly, install `logship` as an explicit dependency.

## Quick Start

### 1. Register the Logship module

Import `LogshipModule` into your application's root module.

```ts
import { Module } from "@nestjs/common";
import { LogshipModule } from "@logship/nestjs";

@Module({
  imports: [
    LogshipModule.forRoot({
      logger: {
        level: "info",
        console: {
          enabled: true,
        },
      },
    }),
  ],
})
export class AppModule {}
```

By default, `LogshipModule` is global. This means its exported providers are available throughout your application without importing the module into every feature module.

### 2. Inject the logger

Inject `LogshipLogger` into any NestJS provider.

```ts
import { Injectable } from "@nestjs/common";
import { LogshipLogger } from "@logship/nestjs";

@Injectable()
export class UsersService {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(UsersService.name);
  }

  findAll() {
    this.logger.log("Fetching users");

    return [];
  }
}
```

The logger is created and injected automatically by NestJS.

You do not need to instantiate it with `new LogshipLogger()`.

### 3. Start logging

Use the familiar logging methods.

```ts
this.logger.log("User created");
this.logger.warn("User profile is incomplete");
this.logger.error("Failed to create user");
this.logger.debug("Validating user input");
this.logger.verbose("Starting user lookup");
```

Log messages are processed by Logship and sent to the enabled logging destinations.

## Module Configuration

Logship supports two configuration methods:

- `LogshipModule.forRoot()` for synchronous configuration.
- `LogshipModule.forRootAsync()` for configuration resolved through a factory, including factories that inject other NestJS providers.

Both methods register the default logger and any configured named loggers.

## Using `forRoot()`

Use `forRoot()` when your logger configuration is available when the module is declared.

```ts
import { Module } from "@nestjs/common";
import { LogshipModule } from "@logship/nestjs";

@Module({
  imports: [
    LogshipModule.forRoot({
      isGlobal: true,
      logger: {
        level: "debug",
        context: "Application",
        console: {
          enabled: true,
        },
        file: {
          enabled: true,
        },
      },
    }),
  ],
})
export class AppModule {}
```

The `logger` property accepts the configuration options supported by `logship`.

### Module options

| Option     | Type                                        | Default           | Description                                               |
| ---------- | ------------------------------------------- | ----------------- | --------------------------------------------------------- |
| `isGlobal` | `boolean`                                   | `true`            | Makes the module's exported providers globally available. |
| `scope`    | `Scope`                                     | `Scope.TRANSIENT` | Controls the lifetime of injected logger providers.       |
| `logger`   | `LoggerConfigOptions`                       | `{}`              | Default logger configuration.                             |
| `loggers`  | `Record<string, LogshipNamedLoggerOptions>` | None              | Defines named loggers with optional overrides.            |

### Minimal configuration

You can register Logship without specifying options.

```ts
LogshipModule.forRoot();
```

In that case, the logger uses the defaults implemented by `logship`.

### Setting the default context

```ts
LogshipModule.forRoot({
  logger: {
    context: "MyApplication",
  },
});
```

The configured context is the starting context for the default logger.

You can override it for a specific injected instance using `setContext()`.

## Injecting `LogshipLogger`

`LogshipLogger` is the main injectable logger for application code.

```ts
import { Injectable } from "@nestjs/common";
import { LogshipLogger } from "@logship/nestjs";

@Injectable()
export class OrdersService {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(OrdersService.name);
  }

  createOrder() {
    this.logger.log("Creating order");

    try {
      // Create the order.

      this.logger.log("Order created successfully");
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message, error.stack);
      }

      throw error;
    }
  }
}
```

### Why use `setContext()`?

A context identifies the source of a log message.

For example:

```ts
this.logger.setContext("OrdersService");
```

This makes it easier to distinguish messages generated by different parts of the application.

We recommend setting the context in the constructor of each service or controller.

The default transient scope allows different consumers to maintain independent contexts.

## Logging Methods

`LogshipLogger` extends the core `Logger` class and exposes its logging methods.

### Informational messages

```ts
this.logger.log("Application initialized");
```

With a context:

```ts
this.logger.log("Payment completed", "Payments");
```

### Errors

```ts
this.logger.error("Database connection failed");
```

With a stack trace:

```ts
try {
  throw new Error("Database unavailable");
} catch (error) {
  if (error instanceof Error) {
    this.logger.error(error.message, error.stack);
  }
}
```

With an explicit context:

```ts
this.logger.error("Database connection failed", undefined, "Database");
```

The second argument is the trace, and the third argument is the context.

### Warnings

```ts
this.logger.warn("Request limit approaching");
```

### Debug messages

```ts
this.logger.debug("Validating request payload");
```

### Verbose messages

```ts
this.logger.verbose("Starting background task");
```

### Updating the context

```ts
this.logger.setContext("BackgroundWorker");
```

### Additional core methods

Depending on the installed core version, the logger also exposes helpers such as:

- `logServiceError()`
- `logObject()`
- `logSection()`
- `fatal()`, where implemented

Refer to the [core documentation](../core/README.md) for the exact signatures and behavior of these methods.

## Named Loggers

Named loggers allow different parts of your application to use different logging configurations.

For example, you may want:

- A default application logger.
- A payments logger.
- A background jobs logger.
- An audit logger.

Each named logger is registered under a unique name.

### Configuring named loggers

```ts
import { Module } from "@nestjs/common";
import { LogshipModule } from "@logship/nestjs";

@Module({
  imports: [
    LogshipModule.forRoot({
      logger: {
        level: "info",
        console: {
          enabled: true,
        },
      },

      loggers: {
        payments: {
          logger: {
            level: "debug",
            context: "Payments",
          },
        },

        jobs: {
          logger: {
            context: "BackgroundJobs",
          },
        },

        audit: {
          logger: {
            context: "Audit",
          },
        },
      },
    }),
  ],
})
export class AppModule {}
```

In this example, three named loggers are registered:

- `payments`
- `jobs`
- `audit`

Named loggers can inherit the default logger configuration and override selected settings.

## Injecting Named Loggers

Use `@InjectLogshipLogger()` to inject a named logger.

```ts
import { Injectable } from "@nestjs/common";
import { InjectLogshipLogger } from "@logship/nestjs";
import type { Logger } from "logship";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectLogshipLogger("payments")
    private readonly logger: Logger,
  ) {}

  processPayment() {
    this.logger.log("Processing payment");
  }
}
```

The string passed to the decorator must match a name configured in the module.

```ts
@InjectLogshipLogger("payments")
```

This resolves the provider registered for the `payments` logger.

### Important: Named logger type

The current implementation creates named loggers using the core `Logger` class.

Therefore, use:

```ts
import type { Logger } from "logship";
```

for the injected property's TypeScript type.

The default logger is injected using `LogshipLogger`, while named loggers use the core `Logger` type.

### Multiple named loggers in one service

You can inject multiple named loggers into the same provider.

```ts
import { Injectable } from "@nestjs/common";
import { InjectLogshipLogger } from "@logship/nestjs";
import type { Logger } from "logship";

@Injectable()
export class CheckoutService {
  constructor(
    @InjectLogshipLogger("payments")
    private readonly paymentsLogger: Logger,

    @InjectLogshipLogger("audit")
    private readonly auditLogger: Logger,
  ) {}

  checkout() {
    this.paymentsLogger.log("Processing checkout");

    // Perform checkout operations.

    this.auditLogger.log("Checkout operation completed");
  }
}
```

Each injected logger uses the configuration associated with its registered name.

## Configuration Inheritance

Named loggers inherit the default logger configuration unless inheritance is explicitly disabled.

This is controlled by `inheritDefaults`.

### Inheriting default configuration

```ts
LogshipModule.forRoot({
  logger: {
    level: "info",
    console: {
      enabled: true,
    },
    file: {
      enabled: false,
    },
  },

  loggers: {
    payments: {
      logger: {
        level: "debug",
      },
    },
  },
});
```

The `payments` logger inherits the default console and file settings while overriding the log level.

### Disabling inheritance

Set `inheritDefaults` to `false`.

```ts
LogshipModule.forRoot({
  logger: {
    level: "info",
    console: {
      enabled: true,
    },
  },

  loggers: {
    audit: {
      inheritDefaults: false,
      logger: {
        level: "warn",
        file: {
          enabled: true,
        },
      },
    },
  },
});
```

The `audit` logger does not inherit the module's default logger configuration.

Any unspecified settings use the defaults from `logship`.

### How configuration merging works

When inheritance is enabled, Logship merges configuration as follows:

| Configuration        | Behavior                                                                         |
| -------------------- | -------------------------------------------------------------------------------- |
| Top-level properties | Named logger values override defaults.                                           |
| `console`            | Default and named console settings are shallow-merged.                           |
| `file`               | Default and named file settings are shallow-merged.                              |
| `loki`               | The named Loki configuration replaces the default Loki configuration as a whole. |

Loki configuration is replaced rather than merged field by field because its authentication options may depend on one another.

### Named logger options

| Option            | Type                  | Default | Description                                                   |
| ----------------- | --------------------- | ------- | ------------------------------------------------------------- |
| `logger`          | `LoggerConfigOptions` | `{}`    | Configuration for the named logger.                           |
| `inheritDefaults` | `boolean`             | `true`  | Whether to inherit the module's default logger configuration. |

## Asynchronous Configuration

Use `LogshipModule.forRootAsync()` when the logger configuration depends on environment variables, secrets, or other NestJS providers.

The `useFactory` function returns a `LogshipModuleOptions` object.

It can be synchronous or asynchronous.

### Basic asynchronous configuration

```ts
import { Module } from "@nestjs/common";
import { LogshipModule } from "@logship/nestjs";

@Module({
  imports: [
    LogshipModule.forRootAsync({
      useFactory: async () => ({
        logger: {
          level: "info",
          console: {
            enabled: true,
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### Using `@nestjs/config`

If your application uses `@nestjs/config`, you can inject `ConfigService` into the configuration factory.

Install it if necessary:

```bash
npm install @nestjs/config
```

Configure Logship:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LogshipModule } from "@logship/nestjs";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    LogshipModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        logger: {
          level: config.get<string>("LOG_LEVEL", "info"),
          context: "Application",
          console: {
            enabled: true,
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

This allows logging configuration to be resolved through NestJS dependency injection.

### Environment variables

For example, your `.env` file might contain:

```env
LOG_LEVEL=debug
```

You can access this value through `ConfigService` and pass it to Logship.

For stricter TypeScript validation, use a level type compatible with `LoggerConfigOptions["level"]` rather than an unrestricted string.

## Named Loggers with `forRootAsync()`

When using asynchronous configuration, named logger names must be declared in the `loggerNames` array.

This is important because NestJS provider tokens are registered when the dynamic module is constructed, before the asynchronous factory result is available.

### Example

```ts
import { Module } from "@nestjs/common";
import { LogshipModule } from "@logship/nestjs";

@Module({
  imports: [
    LogshipModule.forRootAsync({
      loggerNames: ["payments", "audit"],

      useFactory: async () => ({
        logger: {
          level: "info",
          console: {
            enabled: true,
          },
        },

        loggers: {
          payments: {
            logger: {
              level: "debug",
              context: "Payments",
            },
          },

          audit: {
            logger: {
              context: "Audit",
            },
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

You can then inject these loggers normally.

```ts
@InjectLogshipLogger("payments")
private readonly logger: Logger
```

### Why is `loggerNames` required?

With `forRoot()`, Logship can read the names directly from the `loggers` object.

With `forRootAsync()`, the configuration is produced later by a factory.

Therefore, Logship needs the names in advance to register the correct NestJS provider tokens.

### Important rules

- Every named logger you want to inject must be listed in `loggerNames`.
- The corresponding name must exist in the configuration returned by `useFactory`.
- Adding a logger to the returned `loggers` object without adding it to `loggerNames` does not register an injectable named provider.
- Requesting a named logger that has no configuration causes the internal logger factory to throw an error when that provider is resolved.

## Asynchronous Module Options

| Option        | Type                        | Default           | Description                                                 |
| ------------- | --------------------------- | ----------------- | ----------------------------------------------------------- |
| `isGlobal`    | `boolean`                   | `true`            | Makes exported providers globally available.                |
| `scope`       | `Scope`                     | `Scope.TRANSIENT` | Controls logger provider lifetime.                          |
| `imports`     | `ModuleMetadata["imports"]` | `[]`              | Modules required by the configuration factory.              |
| `inject`      | Factory injection tokens    | `[]`              | Dependencies injected into `useFactory`.                    |
| `useFactory`  | Function                    | Required          | Returns module configuration or a promise of configuration. |
| `loggerNames` | `string[]`                  | `[]`              | Names of named logger providers to register.                |

The `useFactory` return value supports the same module configuration structure used by `forRoot()`.

## Provider Scopes

Logship allows you to configure the scope of injected logger providers.

The default scope is `Scope.TRANSIENT`.

```ts
import { Scope } from "@nestjs/common";
import { LogshipModule } from "@logship/nestjs";

LogshipModule.forRoot({
  scope: Scope.TRANSIENT,
});
```

### `Scope.TRANSIENT` — Default

Each consuming provider receives its own logger instance.

```ts
LogshipModule.forRoot({
  scope: Scope.TRANSIENT,
});
```

This is the recommended setting for most applications.

For example, `UsersService` and `OrdersService` can each call `setContext()` without changing the other service's logger context.

### `Scope.DEFAULT` — Singleton

A singleton logger instance is shared by consumers of the same provider token.

```ts
LogshipModule.forRoot({
  scope: Scope.DEFAULT,
});
```

This can be useful when shared instance state is intentional.

However, avoid changing the context of a shared logger from multiple services.

For example:

```ts
this.logger.setContext("UsersService");
```

may affect logs emitted by other consumers of the same singleton logger.

Use a per-message context or a different provider scope when independent contexts are required.

### `Scope.REQUEST` — Request-scoped

A request-scoped logger is created for a NestJS request context.

```ts
LogshipModule.forRoot({
  scope: Scope.REQUEST,
});
```

This may be useful for applications that need request-specific logger state.

Be aware that request-scoped dependencies can affect the scope of providers that consume them.

### Scope comparison

| Scope       | Behavior                                 | Typical use                  |
| ----------- | ---------------------------------------- | ---------------------------- |
| `TRANSIENT` | Separate instance per consuming provider | Independent service contexts |
| `DEFAULT`   | Shared instance per provider token       | Shared logger state          |
| `REQUEST`   | Instance per request context             | Request-specific logging     |

The scope applies to both the default logger provider and registered named logger providers.

## Global and Local Modules

By default, Logship is registered globally.

```ts
LogshipModule.forRoot({
  isGlobal: true,
});
```

This means you can inject exported Logship providers throughout your application without repeatedly importing `LogshipModule`.

### Disabling global registration

```ts
LogshipModule.forRoot({
  isGlobal: false,
});
```

When global registration is disabled, the module's exported providers must be made available through the normal NestJS module import/export system.

For most applications, registering Logship globally once in the root module is the simplest approach.

## Console Logging

Logship uses the console logging functionality provided by `logship`.

Enable it in the module configuration.

```ts
LogshipModule.forRoot({
  logger: {
    console: {
      enabled: true,
    },
  },
});
```

Console logging is useful for:

- Local development
- Container logs
- Cloud hosting platforms
- Application debugging
- Production standard output

You can use console logging alongside file logging and Loki shipping.

## Rotating File Logging

Enable rotating file logging through the `file` configuration.

```ts
LogshipModule.forRoot({
  logger: {
    file: {
      enabled: true,
    },
  },
});
```

The underlying core logger uses Winston's rotating file transport.

File logging can be combined with console output.

```ts
LogshipModule.forRoot({
  logger: {
    console: {
      enabled: true,
    },
    file: {
      enabled: true,
    },
  },
});
```

For file paths, rotation rules, retention settings, and supported options, refer to the [core documentation](../core/README.md).

## Grafana Loki Integration

Logship supports sending application logs to Grafana Loki.

The NestJS integration does not implement a separate Loki client. It uses the Loki shipping functionality provided by `logship`.

### How Loki works with NestJS

When Loki is configured:

1. NestJS injects the appropriate logger.
2. Your service writes a log message.
3. The core logger processes the message.
4. The Loki sink receives the log entry.
5. Entries are buffered and shipped according to the core sink configuration.

### Shared Loki sinks

Multiple injected logger instances can share the same underlying Loki sink when their effective Loki configurations match.

For example, if several services use the same default Loki configuration, they can reuse the same sink and buffer within a single Node.js process.

This is particularly useful with transient logger providers, because each service may have its own logger instance without requiring an independent Loki shipping pipeline.

### Named loggers and Loki

Named loggers can inherit the default Loki configuration.

They can also use a different Loki configuration when needed.

```ts
LogshipModule.forRoot({
  logger: {
    // Default logger settings.
  },

  loggers: {
    payments: {
      logger: {
        // Payments-specific logger settings.
      },
    },
  },
});
```

If a named logger supplies its own `loki` property, that configuration replaces the inherited Loki configuration.

It is not deep-merged with the default Loki settings.

For the exact Loki endpoint, authentication, batching, and retry options, consult the core configuration reference.

## TypeScript Support

Logship exports module configuration types for TypeScript users.

```ts
import type {
  LogshipModuleOptions,
  LogshipModuleAsyncOptions,
  LogshipNamedLoggerOptions,
} from "@logship/nestjs";
```

### Type-safe module configuration

```ts
import type { LogshipModuleOptions } from "@logship/nestjs";

const logshipOptions = {
  isGlobal: true,
  logger: {
    level: "info",
    console: {
      enabled: true,
    },
  },
  loggers: {
    payments: {
      logger: {
        level: "debug",
      },
    },
  },
} satisfies LogshipModuleOptions;
```

Then register it:

```ts
LogshipModule.forRoot(logshipOptions);
```

TypeScript can detect unknown configuration properties and incompatible types.

### Named logger names and TypeScript

The decorator accepts a string:

```ts
@InjectLogshipLogger("payments")
```

TypeScript does not automatically know which names were registered in `forRoot()`.

For example, this typo may still compile:

```ts
@InjectLogshipLogger("paymnets")
```

If the name does not match a registered provider, NestJS will fail to resolve that dependency.

To reduce mistakes, define shared constants for logger names.

```ts
export const LOGGER_NAMES = {
  PAYMENTS: "payments",
  AUDIT: "audit",
} as const;
```

Use them when configuring named loggers:

```ts
LogshipModule.forRoot({
  loggers: {
    [LOGGER_NAMES.PAYMENTS]: {
      logger: {
        context: "Payments",
      },
    },
    [LOGGER_NAMES.AUDIT]: {
      logger: {
        context: "Audit",
      },
    },
  },
});
```

And when injecting them:

```ts
@InjectLogshipLogger(LOGGER_NAMES.PAYMENTS)
private readonly logger: Logger
```

This keeps logger names consistent across your application.

## Practical Examples

### Logging in a controller

```ts
import { Controller, Get } from "@nestjs/common";
import { LogshipLogger } from "@logship/nestjs";

@Controller("health")
export class HealthController {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(HealthController.name);
  }

  @Get()
  check() {
    this.logger.log("Health check requested");

    return {
      status: "ok",
    };
  }
}
```

### Logging in a service

```ts
import { Injectable } from "@nestjs/common";
import { LogshipLogger } from "@logship/nestjs";

@Injectable()
export class AuthService {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(AuthService.name);
  }

  async authenticate(userId: string) {
    this.logger.log(`Authenticating user ${userId}`);

    try {
      // Perform authentication.

      this.logger.log("Authentication successful");
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message, error.stack);
      }

      throw error;
    }
  }
}
```

### Logging in a guard

```ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { LogshipLogger } from "@logship/nestjs";

@Injectable()
export class ExampleGuard implements CanActivate {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(ExampleGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    this.logger.debug(`Checking access to ${request.url}`);

    return true;
  }
}
```

### Logging in an interceptor

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { LogshipLogger } from "@logship/nestjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    const startedAt = Date.now();

    this.logger.log(`Incoming ${request.method} ${request.url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;

          this.logger.log(
            `${request.method} ${request.url} completed in ${duration}ms`,
          );
        },
        error: (error: unknown) => {
          if (error instanceof Error) {
            this.logger.error(error.message, error.stack);
          }
        },
      }),
    );
  }
}
```

Register the interceptor using NestJS dependency injection so its logger can be injected.

### Named logger for background jobs

Configure the named logger:

```ts
LogshipModule.forRoot({
  logger: {
    level: "info",
    console: {
      enabled: true,
    },
  },
  loggers: {
    jobs: {
      logger: {
        level: "debug",
        context: "BackgroundJobs",
      },
    },
  },
});
```

Inject it into your worker service:

```ts
import { Injectable } from "@nestjs/common";
import { InjectLogshipLogger } from "@logship/nestjs";
import type { Logger } from "logship";

@Injectable()
export class JobsService {
  constructor(
    @InjectLogshipLogger("jobs")
    private readonly logger: Logger,
  ) {}

  async processJob(jobId: string) {
    this.logger.log(`Starting job ${jobId}`);

    try {
      // Process the job.

      this.logger.log(`Job ${jobId} completed`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message, error.stack);
      }

      throw error;
    }
  }
}
```

## NestJS System Logging

By default, registering `LogshipModule` makes Logship available for injection into your application's providers.

It does not automatically replace NestJS's built-in system logger.

System logs include framework messages generated during application startup, dependency initialization, and certain error-handling operations.

NestJS supports custom loggers through its `LoggerService` interface.

Logship's injectable logger is intended to implement that interface.

However, using a transient provider as the application's system logger requires care: NestJS's standard `app.get()` lookup is not the appropriate way to retrieve a transient provider.

If you want to replace NestJS system logging, verify the integration against the NestJS version you use and resolve the logger through a supported provider scope or a dedicated singleton registration.

See the official NestJS logger documentation for more information:

https://docs.nestjs.com/techniques/logger

## Public API

The package exposes the following main APIs.

| Export                      | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `LogshipModule`             | Configures and registers Logship providers.            |
| `LogshipLogger`             | Main injectable logger for NestJS applications.        |
| `InjectLogshipLogger`       | Decorator for injecting named loggers.                 |
| `LogshipModuleOptions`      | TypeScript type for synchronous module configuration.  |
| `LogshipModuleAsyncOptions` | TypeScript type for asynchronous module configuration. |
| `LogshipNamedLoggerOptions` | TypeScript type for named logger configuration.        |

### Importing the public API

```ts
import {
  LogshipModule,
  LogshipLogger,
  InjectLogshipLogger,
} from "@logship/nestjs";
```

Configuration types can be imported separately.

```ts
import type {
  LogshipModuleOptions,
  LogshipModuleAsyncOptions,
  LogshipNamedLoggerOptions,
} from "@logship/nestjs";
```

The internal logger factory and dependency injection tokens are implementation details.

Applications normally do not need to interact with them directly.

## Troubleshooting

### NestJS cannot resolve `LogshipLogger`

Make sure `LogshipModule` is registered in your application.

```ts
@Module({
  imports: [LogshipModule.forRoot()],
})
export class AppModule {}
```

If you disabled global registration, make sure the consuming module has access to the exported logger provider.

### NestJS cannot resolve a named logger

Check that the logger name exists in the `loggers` configuration.

```ts
loggers: {
  payments: {
    logger: {
      context: "Payments",
    },
  },
}
```

Then use the matching name:

```ts
@InjectLogshipLogger("payments")
```

For `forRootAsync()`, also ensure that the name appears in `loggerNames`.

### Logger contexts are changing unexpectedly

Check whether you configured:

```ts
scope: Scope.DEFAULT;
```

Singleton providers share their mutable logger context.

Use the default transient scope if different services need independent contexts.

### Logger configuration is not applied

Check that you placed core logger settings inside the `logger` property.

Correct:

```ts
LogshipModule.forRoot({
  logger: {
    level: "debug",
  },
});
```

Incorrect:

```ts
LogshipModule.forRoot({
  level: "debug",
});
```

### A named logger is not inheriting settings

Check the `inheritDefaults` property.

```ts
loggers: {
  payments: {
    inheritDefaults: false,
    logger: {
      level: "debug",
    },
  },
}
```

When inheritance is disabled, the named logger does not receive the default logger configuration.

### Debug logs are missing

Verify that your configured logging level allows debug messages.

```ts
LogshipModule.forRoot({
  logger: {
    level: "debug",
  },
});
```

### Loki is not receiving logs

Check the Loki endpoint, credentials, network access, and core Loki configuration.

Named loggers with their own Loki settings replace the inherited Loki configuration rather than merging it.

See the [core README](../core/README.md) for additional troubleshooting guidance.

### TypeScript reports decorator errors

Ensure that your NestJS TypeScript configuration supports decorators.

Typical NestJS settings include:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### `@InjectLogshipLogger()` is not recognized

Ensure you are importing it from the correct package:

```ts
import { InjectLogshipLogger } from "@logship/nestjs";
```

Also verify that the named logger is registered in your module configuration.

## Best Practices

1. Register `LogshipModule` once in your application's root module.
2. Use the default transient scope when services set their own logger contexts.
3. Set meaningful contexts such as `UsersService`, `PaymentsService`, or `OrdersController`.
4. Use named loggers when a component needs a genuinely different configuration.
5. Keep Loki credentials in environment variables or a secrets manager.
6. Avoid logging passwords, tokens, or other sensitive information.
7. Configure log levels according to your environment.
8. Prefer centralized logging for applications running across multiple containers or servers.
9. Keep logger names consistent by using shared constants.
10. Handle application shutdown appropriately when using buffered log shipping.

## Related Documentation

- [logship](../core/README.md) — Core logger API, configuration, file logging, and Loki shipping.
- [NestJS Documentation](https://docs.nestjs.com/) — NestJS framework documentation.
- [NestJS Custom Logger](https://docs.nestjs.com/techniques/logger) — Integrating custom loggers with NestJS.
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules) — Understanding `forRoot()` and `forRootAsync()`.
- [NestJS Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes) — Understanding singleton, transient, and request-scoped providers.

## License

See the repository's license file for licensing information.

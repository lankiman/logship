# Logship

**Logship** is a TypeScript logging library for Node.js applications, with support for structured logging, console output, rotating log files, and shipping logs to Grafana Loki.

Built on top of [Winston](https://github.com/winstonjs/winston), Logship provides a straightforward logging API and an optional integration for [NestJS](https://nestjs.com/).

## Features

- **Simple logging API** — Log messages using familiar methods such as `log()`, `error()`, `warn()`, `debug()`, and `verbose()`.
- **Structured logging** — Organize log messages with contexts and consistent formatting.
- **Console logging** — Output logs directly to the terminal.
- **Rotating log files** — Store logs in automatically rotated files.
- **Grafana Loki integration** — Ship application logs to Loki for centralized monitoring.
- **Shared Loki connections** — Reuse Loki sinks and buffers across compatible logger instances within the same process.
- **TypeScript support** — Configuration types and declarations are included.
- **NestJS integration** — Use Logship with NestJS dependency injection, modules, and named loggers.
- **Flexible configuration** — Enable and configure logging destinations according to your application's needs.

## Packages

Logship is organized into two packages.

| Package                                | Description                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| [`logship`](./packages/core)           | Standalone logging library for Node.js and TypeScript applications.                    |
| [`@logship/nestjs`](./packages/nestjs) | NestJS integration with dependency injection, module configuration, and named loggers. |

Each package has its own documentation, installation instructions, and usage examples.

### Which package should I use?

**Use `logship`** if you are building a Node.js application, backend service, script, worker, or any other project that needs logging without NestJS.

**Use `@logship/nestjs`** if your application uses NestJS and you want Logship to integrate with its dependency injection system.

## Quick Start

### Node.js / TypeScript

Install the core package:

```bash
npm install logship
```

Or with pnpm:

```bash
pnpm add logship
```

Create a logger:

```ts
import { Logger } from "logship";

const logger = new Logger({
  level: "info",
  context: "MyApplication",
});

logger.log("Application started");
logger.warn("A warning occurred");
logger.error("Something went wrong");
```

You can configure console output, rotating files, and Loki shipping through the logger options.

**Full documentation:** [logship README](./packages/core/README.md)

### NestJS

Install the NestJS integration:

```bash
npm install @logship/nestjs
```

Or with pnpm:

```bash
pnpm add @logship/nestjs
```

Register Logship in your application module:

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

Inject the logger into a service:

```ts
import { Injectable } from "@nestjs/common";
import { LogshipLogger } from "@logship/nestjs";

@Injectable()
export class AppService {
  constructor(private readonly logger: LogshipLogger) {
    this.logger.setContext(AppService.name);
  }

  getHello(): string {
    this.logger.log("Handling hello request");

    return "Hello World!";
  }
}
```

Logship also supports asynchronous module configuration and named loggers.

**Full documentation:** [@logship/nestjs README](./packages/nestjs/README.md)

## Logging Destinations

Logship supports multiple logging destinations depending on your configuration.

### Console

Display logs in the terminal during development or production.

### Rotating Files

Write logs to files using Winston's daily rotating file transport.

This allows applications to retain local log files without continuously writing to a single file.

### Grafana Loki

Send logs to a Grafana Loki endpoint for centralized log storage, searching, and monitoring.

Logship supports buffered log shipping and reuses compatible Loki sinks within the same Node.js process.

For Loki configuration, authentication, and available options, see the [core documentation](./packages/core/README.md).

## TypeScript Support

Logship is written in TypeScript and provides types for its public configuration API.

For standalone applications:

```ts
import { Logger } from "logship";
import type { LoggerConfigOptions } from "logship";

const options: LoggerConfigOptions = {
  level: "debug",
  context: "API",
};

const logger = new Logger(options);
```

For NestJS, the integration exposes module configuration types alongside its public logger, module, and decorator APIs.

## Documentation

Detailed usage instructions are maintained separately for each package.

| Documentation                                       | Topics                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [Core Documentation](./packages/core/README.md)     | Installation, configuration, logging methods, contexts, console output, file rotation, Loki shipping, and troubleshooting. |
| [NestJS Documentation](./packages/nestjs/README.md) | Module setup, dependency injection, async configuration, named loggers, decorators, scopes, and troubleshooting.           |

## Development

Logship is maintained as a pnpm monorepo.

### Repository Structure

```text
logship/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   ├── package.json
│   │   └── README.md
│   └── nestjs/
│       ├── src/
│       ├── package.json
│       └── README.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Prerequisites

- Node.js
- pnpm

### Install Dependencies

```bash
pnpm install
```

### Build Packages

```bash
pnpm build
```

The workspace contains both the standalone logging implementation and its NestJS integration.

## License

See the repository's license file for licensing information.

# logship

A TypeScript logging library for Node.js applications with console logging, rotating log files, and Grafana Loki integration.

**logship** provides a straightforward logging API built on Winston. It supports application contexts, configurable log levels, file rotation, and centralized log shipping through Loki.

It can be used in backend applications, APIs, background workers, command-line tools, scheduled jobs, and other Node.js environments.

## Features

- Simple, class-based logging API
- TypeScript configuration support
- Configurable log levels
- Context-aware log messages
- Console logging
- Rotating log files
- Grafana Loki log shipping
- Buffered and batched Loki delivery
- Shared Loki sinks for compatible logger instances
- Optional Loki authentication
- Support for multiple logger instances
- Utility methods for logging errors, objects, and sections

## Installation

Install using your preferred package manager.

**npm**

```bash
npm install logship
```

**pnpm**

```bash
pnpm add logship
```

**yarn**

```bash
yarn add logship
```

## Quick Start

Import the `Logger` class and create a logger instance.

```ts
import { Logger } from "logship";

const logger = new Logger();

logger.log("Application started");
logger.warn("Configuration warning");
logger.error("An unexpected error occurred");
logger.debug("Debug information");
logger.verbose("Additional diagnostic information");
```

You can provide configuration when creating the logger.

```ts
import { Logger } from "logship";

const logger = new Logger({
  level: "debug",
  context: "Application",
  console: {
    enabled: true,
  },
});

logger.log("Server initialized");
logger.debug("Loading application configuration");
```

The configured log level determines which messages are emitted.

## Creating a Logger

The `Logger` constructor accepts an optional `LoggerConfigOptions` object.

```ts
import { Logger } from "logship";
import type { LoggerConfigOptions } from "logship";

const options: LoggerConfigOptions = {
  level: "info",
  context: "API",
  console: {
    enabled: true,
  },
};

const logger = new Logger(options);
```

You can create separate logger instances for different parts of your application.

```ts
const authLogger = new Logger({
  context: "Authentication",
});

const paymentLogger = new Logger({
  context: "Payments",
});

authLogger.log("Authentication initialized");
paymentLogger.log("Payment service initialized");
```

Each instance maintains its own logger configuration and context.

When Loki shipping is enabled, compatible instances can reuse the same underlying Loki sink within the same Node.js process.

## Logging Methods

The `Logger` class exposes methods for different logging levels and common logging operations.

### `log(message, context?)`

Logs a general informational message.

```ts
logger.log("Application started");
```

You can optionally provide a context.

```ts
logger.log("User authenticated", "Authentication");
```

### `error(message, trace?, context?)`

Logs an error message.

```ts
logger.error("Database connection failed");
```

You can include a stack trace.

```ts
try {
  throw new Error("Connection failed");
} catch (error) {
  if (error instanceof Error) {
    logger.error(error.message, error.stack);
  }
}
```

You can also provide a context as the third argument.

```ts
logger.error("Database connection failed", undefined, "Database");
```

**Important:** The second argument is the trace, not the context.

### `warn(message, context?)`

Logs a warning.

```ts
logger.warn("API rate limit is approaching");
```

With a context:

```ts
logger.warn("Retrying connection", "Database");
```

### `debug(message, context?)`

Logs debugging information.

```ts
logger.debug("Processing incoming request");
```

Debug messages are subject to the configured log level.

```ts
const logger = new Logger({
  level: "debug",
});

logger.debug("Request payload validated");
```

### `verbose(message, context?)`

Logs detailed diagnostic information.

```ts
logger.verbose("Starting background synchronization");
```

With a context:

```ts
logger.verbose("Synchronization completed", "Worker");
```

### `fatal(message, context?)`

If your installed version includes `fatal()`, use it for critical failures.

```ts
logger.fatal("Application cannot continue");
```

**Note:** Verify that `fatal()` is present in your installed version's `Logger` API. It should not be assumed available in older builds.

## Log Levels

Logship supports level-based filtering.

Configure the level when constructing the logger.

```ts
const logger = new Logger({
  level: "warn",
});
```

The configured level controls which messages are eligible for logging.

For example, with a warning-level threshold, informational and debugging messages may be filtered out.

```ts
const logger = new Logger({
  level: "warn",
});

logger.log("General information");
logger.debug("Debug details");
logger.warn("A warning occurred");
logger.error("An error occurred");
```

Use a more detailed level during development and a less verbose level in production, according to your application's needs.

The exact accepted level values and ordering are defined by the installed Logship version and its Winston configuration.

## Logging Contexts

Contexts identify which application component produced a log message.

They are especially useful when multiple services or modules write to the same logging destination.

### Configure a default context

```ts
const logger = new Logger({
  context: "Authentication",
});

logger.log("Authentication service started");
```

### Change the context

Use `setContext()` to update the logger's current context.

```ts
logger.setContext("Payments");

logger.log("Payment processing started");
```

### Provide a context for an individual message

```ts
logger.log("User created", "Users");
logger.warn("Invalid request", "Validation");
logger.error("Connection failed", undefined, "Database");
```

A per-message context allows you to identify the source of a particular log without creating a separate logger.

### Using separate instances

For applications with multiple components, separate logger instances can help keep contexts independent.

```ts
const usersLogger = new Logger({
  context: "Users",
});

const ordersLogger = new Logger({
  context: "Orders",
});

usersLogger.log("User created");
ordersLogger.log("Order submitted");
```

## Console Logging

Console logging writes messages to the application's standard output or error streams through the configured Winston transport.

Enable console output using the `console` configuration.

```ts
const logger = new Logger({
  console: {
    enabled: true,
  },
});

logger.log("Visible in the console");
```

Console logging is useful for:

- Local development
- Docker containers
- Cloud application logs
- Debugging
- Server and worker processes

You can combine console logging with file logging and Loki shipping when those destinations are enabled.

### Console configuration

```ts
const logger = new Logger({
  level: "debug",
  context: "API",
  console: {
    enabled: true,
  },
});
```

For additional console options, refer to the `LoggerConfigOptions` declaration shipped with your installed version.

## Rotating File Logging

Logship supports rotating log files through `winston-daily-rotate-file`.

Rotation helps applications avoid writing all logs to one continuously growing file.

Enable file logging through the `file` configuration.

```ts
const logger = new Logger({
  file: {
    enabled: true,
  },
});

logger.log("This message can be written to a log file");
```

File logging can be combined with console output.

```ts
const logger = new Logger({
  level: "info",
  context: "API",
  console: {
    enabled: true,
  },
  file: {
    enabled: true,
  },
});
```

### How rotation works

The file transport manages log files according to its configured rotation rules.

Depending on the available options, rotating file transports can support:

- Date-based file rotation
- File size limits
- Retention periods
- Filename patterns
- Compression of older log files

The exact file options and defaults depend on the Logship implementation. Consult the `file` field in `LoggerConfigOptions` before specifying additional properties.

### Deployment considerations

If file logging is enabled, ensure the application has permission to write to its configured log directory.

For containerized deployments, remember that files stored inside a container may be lost when the container is replaced unless persistent storage is configured.

For applications running on ephemeral infrastructure, console logging or centralized log shipping may be more appropriate than relying exclusively on local files.

## Grafana Loki Integration

Logship can ship application logs to Grafana Loki for centralized log storage and querying.

Grafana Loki is commonly used alongside Grafana to search, filter, and visualize logs from multiple applications.

### What Loki shipping provides

With Loki enabled, Logship can:

- Collect log entries from logger instances
- Buffer log entries before delivery
- Send entries in batches
- Reuse compatible Loki sinks
- Apply configured authentication
- Handle delivery failures according to the sink implementation

This allows applications to centralize logs without requiring each logger instance to maintain an entirely separate shipping pipeline.

### Loki configuration

Loki is configured using the `loki` property.

```ts
import { Logger } from "logship";

const logger = new Logger({
  context: "API",
  loki: {
    // Supply the Loki options required by your installed version.
  },
});
```

The exact Loki configuration must match the `LokiConfigOptions` type provided by the package.

Depending on the selected authentication mode, the configuration may require different fields.

**Do not mix authentication fields from different modes.** Loki authentication is represented by a discriminated TypeScript configuration, so the appropriate credentials must match the selected authentication type.

### Using environment variables

Keep credentials and endpoint configuration outside your application source code.

For example:

```ts
const lokiUrl = process.env.LOKI_URL;

if (!lokiUrl) {
  throw new Error("LOKI_URL is required");
}
```

You can then use the validated environment variables when constructing your Loki configuration.

Avoid hardcoding usernames, passwords, or other secrets in your repository.

### Shared Loki sinks

When multiple logger instances use equivalent effective Loki configurations, Logship can reuse the same underlying sink through its Loki sink manager.

```ts
const usersLogger = new Logger({
  context: "Users",
  loki: sharedLokiConfig,
});

const ordersLogger = new Logger({
  context: "Orders",
  loki: sharedLokiConfig,
});
```

In this example, both loggers can share the Loki shipping infrastructure when their normalized Loki configurations match.

This sharing occurs within a single Node.js process.

It does not mean separate Node.js processes, containers, or servers share the same in-memory buffer.

### Buffering and batching

Logship's Loki integration uses buffering to collect log entries before sending them.

Instead of requiring a separate HTTP request for every message, the sink can group entries for delivery.

This can reduce request overhead when an application generates many logs.

The exact batch size, flush timing, retry behavior, and queue limits are determined by the implemented Loki sink and its configuration.

### Delivery failures

Loki shipping depends on network connectivity and the availability of the configured Loki endpoint.

Potential causes of delivery failure include:

- Invalid Loki endpoint
- Incorrect credentials
- Network interruptions
- DNS failures
- Loki server downtime
- Invalid authentication configuration
- Requests rejected by the Loki service

Check the Loki endpoint, authentication, and application diagnostics when investigating delivery problems.

### Application shutdown

Buffered log shipping may require flushing pending entries before process termination.

Applications that need guaranteed shutdown handling should inspect the lifecycle methods available in their installed Logship version and integrate them into their shutdown sequence.

Do not assume that terminating the Node.js process immediately will deliver every buffered log entry.

## Utility Methods

Logship also provides helper methods for common logging tasks.

### `logServiceError()`

Use this helper for service-related error logging.

Its exact arguments and formatting behavior are defined by the `Logger` implementation.

### `logObject()`

Use this helper when you need to log an object.

Before logging an object, ensure it does not contain passwords, tokens, session secrets, or other sensitive information.

### `logSection()`

Use this helper to separate or highlight sections of application logs.

These utility methods supplement the standard logging methods.

Refer to the exported `Logger` class declarations for their exact method signatures.

## Multiple Logger Instances

You can create multiple logger instances in the same application.

```ts
import { Logger } from "logship";

const apiLogger = new Logger({
  context: "API",
});

const workerLogger = new Logger({
  context: "Worker",
});

apiLogger.log("HTTP server started");
workerLogger.log("Background worker started");
```

This is useful when different application components need their own contexts or configuration.

For example, one component may use more detailed logging than another.

```ts
const apiLogger = new Logger({
  level: "info",
  context: "API",
});

const workerLogger = new Logger({
  level: "debug",
  context: "Worker",
});
```

## TypeScript Configuration

Logship exports its public configuration type.

```ts
import { Logger } from "logship";
import type { LoggerConfigOptions } from "logship";

const config: LoggerConfigOptions = {
  level: "info",
  context: "Application",
  console: {
    enabled: true,
  },
  file: {
    enabled: false,
  },
};

const logger = new Logger(config);
```

TypeScript can report incompatible values and unknown configuration properties when you use the exported type.

You can also use `satisfies` to validate a configuration while preserving its inferred type.

```ts
import type { LoggerConfigOptions } from "logship";

const config = {
  level: "debug",
  context: "API",
  console: {
    enabled: true,
  },
} satisfies LoggerConfigOptions;
```

This is useful when maintaining shared configuration objects.

## Practical Examples

### Express Application

```ts
import express from "express";
import { Logger } from "logship";

const app = express();

const logger = new Logger({
  context: "HTTP",
  level: "info",
});

app.get("/", (_req, res) => {
  logger.log("GET /");

  res.json({
    message: "Hello from Logship",
  });
});

app.listen(3000, () => {
  logger.log("Server listening on port 3000");
});
```

### Background Worker

```ts
import { Logger } from "logship";

const logger = new Logger({
  context: "Worker",
  level: "debug",
});

async function processJob(jobId: string): Promise<void> {
  logger.log(`Processing job ${jobId}`);

  try {
    // Perform job processing.

    logger.log(`Job ${jobId} completed`);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message, error.stack);
    }

    throw error;
  }
}
```

### Application with Separate Contexts

```ts
import { Logger } from "logship";

const databaseLogger = new Logger({
  context: "Database",
});

const authenticationLogger = new Logger({
  context: "Authentication",
});

databaseLogger.log("Database initialized");
authenticationLogger.log("Authentication initialized");
```

### Production-Oriented Configuration

```ts
import { Logger } from "logship";

const logger = new Logger({
  level: "info",
  context: "ProductionAPI",
  console: {
    enabled: true,
  },
  file: {
    enabled: false,
  },
});

logger.log("Application started");
```

For production environments, configure the appropriate destinations based on your infrastructure, log retention requirements, and operational needs.

## Troubleshooting

### Logs are not appearing

Check the following:

1. Verify that the logger is being created successfully.
2. Confirm that the configured log level allows the message.
3. Confirm that the intended logging destination is enabled.
4. Check whether the application process is exiting before buffered logs are delivered.
5. Check for errors from the underlying transport.

### File logs are not being created

Verify that:

- File logging is enabled.
- The configured directory exists or can be created.
- The application has write permissions.
- The filesystem is writable.
- The container or hosting environment supports the intended storage behavior.

### Loki is not receiving logs

Verify that:

- The Loki endpoint is correct.
- The endpoint is reachable from the application.
- Authentication credentials are valid.
- The configuration matches the selected authentication mode.
- Network policies allow outgoing requests.
- The Loki service is accepting push requests.

### Debug logs are missing

Check the configured logging level.

```ts
const logger = new Logger({
  level: "debug",
});

logger.debug("Debug logging enabled");
```

### Logs contain sensitive data

Review what your application passes to the logger.

Avoid logging:

- Passwords
- API keys
- Authentication tokens
- Session cookies
- Private credentials
- Sensitive personal information

Sanitize objects and error details before logging them when necessary.

## API Overview

The primary public API is the `Logger` class.

| API                                | Purpose                             |
| ---------------------------------- | ----------------------------------- |
| `new Logger(options?)`             | Create a logger                     |
| `log(message, context?)`           | Log an informational message        |
| `error(message, trace?, context?)` | Log an error                        |
| `warn(message, context?)`          | Log a warning                       |
| `debug(message, context?)`         | Log debugging information           |
| `verbose(message, context?)`       | Log detailed diagnostic information |
| `setContext(context)`              | Update the logger context           |
| `logServiceError(...)`             | Log a service-related error         |
| `logObject(...)`                   | Log an object                       |
| `logSection(...)`                  | Log a section                       |
| `fatal(message, context?)`         | Log a fatal error, where supported  |

### Public exports

```ts
import { Logger } from "logship";
import type { LoggerConfigOptions } from "logship";
```

These are the main exports needed by most applications.

## License

See the repository's license file for licensing information.

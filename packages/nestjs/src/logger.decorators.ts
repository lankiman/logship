import { Inject } from "@nestjs/common";

import { getLogshipLoggerToken } from "./logger.constants.js";

/**
 * Injects a named Logship logger registered through
 * LogshipModule.forRoot() or LogshipModule.forRootAsync().
 *
 * @param name - Name of the registered logger.
 *
 * @example
 * @Injectable()
 * export class PaymentService {
 *   public constructor(
 *     @InjectLogshipLogger("payments")
 *     private readonly logger: Logger,
 *   ) {}
 * }
 */
export function InjectLogshipLogger(
  name: string,
): ParameterDecorator & PropertyDecorator {
  return Inject(getLogshipLoggerToken(name));
}

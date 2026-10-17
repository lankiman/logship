import { LokiSink } from "./loki.sink";
import type { LokiConfigOptions } from "../types";
import { normalizeLokiConfig } from "../utils/loki.helpers";

export class LokiSinkManager {
  private constructor() {}

  private static readonly sinks = new Map<string, LokiSink>();

  static getSink(config: LokiConfigOptions): LokiSink {
    const normalized = normalizeLokiConfig(config);
    const key = JSON.stringify(normalized);

    let sink = this.sinks.get(key);

    if (!sink) {
      sink = new LokiSink(config);
      this.sinks.set(key, sink);
    }

    return sink;
  }
}

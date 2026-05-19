export type DebugLogItem = {
  timestamp: string;
  message: string;
};

export class DebugLogger {
  private logs: DebugLogItem[] = [];

  private maxItems: number;

  constructor(maxItems = 200) {
    this.maxItems = maxItems;
  }

  add(message: string) {
    this.logs = [
      {
        timestamp: new Date().toISOString(),
        message,
      },
      ...this.logs,
    ].slice(0, this.maxItems);
  }

  getAll() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }

  exportJson(extra?: Record<string, unknown>) {
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        ...extra,
        logs: this.logs,
      },
      null,
      2
    );
  }
}

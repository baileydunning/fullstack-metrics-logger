export interface BackendMetrics {
  httpRequests: HttpRequestMetrics;
  garbageCollections: GarbageCollectionMetrics[];
  eventLoopDelays: EventLoopDelayMetrics[];
  processStats: ProcessStats[];
  osStats: OsStats[];
  activeHandles: ActiveHandleMetrics[];
  errorCounts: ErrorMetrics;
  userMetrics: UserMetrics;
}

// Metrics for HTTP request performance
export interface HttpRequestMetrics {
  totalCount: number;
  errorCount: number;
  durationsMs: number[];
}

// Metrics for garbage collection events
export interface GarbageCollectionMetrics {
  type: number;
  durationMs: number;
  timestamp: number;
}

// Metrics for event loop delays
export interface EventLoopDelayMetrics {
  meanMs: number;
  maxMs: number;
  minMs: number;
  p50Ms: number;
  p99Ms: number;
  timestamp: number;
}

// Process resource usage (memory, CPU)
export interface ProcessStats {
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  timestamp: number;
}

// OS-level statistics (load averages, memory, uptime)
export interface OsStats {
  loadAvg: number[];
  freeMemBytes: number;
  totalMemBytes: number;
  uptimeSec: number;
  cpuCores: number;
  timestamp: number;
}

// Active handles (e.g., files, sockets)
export interface ActiveHandleMetrics {
  count: number;
  timestamp: number;
}

// Error counts (uncaught exceptions, unhandled promise rejections)
export interface ErrorMetrics {
  uncaughtExceptions: number;
  unhandledRejections: number;
}

// User interaction and behavior metrics
export interface UserMetrics {
  activeUsers: number;
  sessionDurationMs: number[];
  pageViews: number;
  customEvents: Record<string, number>;
}

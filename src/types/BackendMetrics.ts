export interface BackendMetrics {
  httpRequests: {
    totalCount: number;           // Total number of HTTP requests handled
    errorCount: number;           // Number of HTTP requests with error status codes (4xx/5xx)
    durationsMs: number[];        // Array of request durations in milliseconds
  };
  garbageCollections: {           // Array of garbage collection events
    type: number;                 // GC kind/type (e.g., 1=minor, 2=major, 4=incremental, 8=weak)
    durationMs: number;           // Duration of the GC pause in milliseconds
    timestamp: number;            // When the GC event occurred (ms since epoch)
  }[];
  eventLoopDelays: {              // Array of event loop delay stats
    meanMs: number;               // Mean event loop delay in milliseconds
    maxMs: number;                // Max event loop delay in milliseconds
    minMs: number;                // Min event loop delay in milliseconds
    p50Ms: number;                // 50th percentile (median) delay in ms
    p99Ms: number;                // 99th percentile delay in ms
    timestamp: number;            // When the sample was taken
  }[];
  processStats: {                 // Array of process resource usage snapshots
    memory: NodeJS.MemoryUsage;   // Memory usage stats
    cpu: NodeJS.CpuUsage;         // CPU usage stats
    timestamp: number;            // When the sample was taken
  }[];
  osStats: {                      // Array of OS-level stats
    loadAvg: number[];            // 1, 5, and 15 minute load averages
    freeMemBytes: number;         // Free system memory in bytes
    totalMemBytes: number;        // Total system memory in bytes
    uptimeSec: number;            // System uptime in seconds
    cpuCores: number;             // Number of CPU cores
    timestamp: number;            // When the sample was taken
  }[];
  activeHandles: {                // Array of active handle counts
    count: number;                // Number of active handles (files, sockets, etc.)
    timestamp: number;            // When the sample was taken
  }[];
  errorCounts: {
    uncaughtExceptions: number;   // Number of uncaught exceptions
    unhandledRejections: number;  // Number of unhandled promise rejections
  };
}
import { Express, Request, Response, NextFunction } from 'express';
import { performance, PerformanceObserver } from 'perf_hooks';
import { BackendMetrics } from '../types/BackendMetrics';
import os from 'os';


export function captureBackendMetrics(
  app: Express,
  opts: { statsIntervalMs?: number } = {}
) {
  const interval = opts.statsIntervalMs ?? 60_000;

  // Metrics storage
  const metrics: BackendMetrics = {
    httpRequests: { totalCount: 0, errorCount: 0, durationsMs: [] },
    garbageCollections: [],
    eventLoopDelays: [],
    processStats: [],
    osStats: [],
    activeHandles: [],
    errorCounts: { uncaughtExceptions: 0, unhandledRejections: 0 }
  };

  function formatMs(ms: number): string {
    return ms < 1000 ? `${ms.toFixed(2)} ms` : `${(ms / 1000).toFixed(2)} s`;
  }
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  function formatLoadAvg(load: number[]): string {
    return load.map(l => l.toFixed(2)).join(', ');
  }

  const desiredRanges = {
    httpRequestDurationMs: '0-500 ms (ideal)',
    gcPauseDurationMs: '0-50 ms (ideal)',
    eventLoopDelayMs: '0-50 ms (ideal)',
    processMemory: 'Varies, < 500 MB (ideal for small apps)',
    cpuUsage: 'Varies, < 80% (ideal)',
    osLoadAvg: 'Varies, < # of CPU cores',
    activeHandles: 'Varies, < 1000 (ideal)',
  };

  // 1) HTTP request timing
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    res.on('finish', () => {
      metrics.httpRequests.totalCount++;
      const duration = performance.now() - start;
      metrics.httpRequests.durationsMs.push(duration);
      if (res.statusCode >= 400) metrics.httpRequests.errorCount++;
      console.log({
        metric: 'http_request',
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        duration: formatMs(duration),
        desiredRange: desiredRanges.httpRequestDurationMs,
        timestamp: Date.now(),
      });
    });
    next();
  });

  // 2) GC pause observer
  if (typeof PerformanceObserver !== 'undefined') {
    const gcObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        metrics.garbageCollections.push({
          type: (entry as any).detail?.kind,
          durationMs: entry.duration,
          timestamp: Date.now(),
        });
        console.log({
          metric: 'gc_pause',
          type: (entry as any).detail?.kind,
          duration: formatMs(entry.duration),
          desiredRange: desiredRanges.gcPauseDurationMs,
          timestamp: Date.now(),
        });
      }
    });
    gcObs.observe({ entryTypes: ['gc'], buffered: true });
  }

  // 3) Event-loop delay
  try {
    const h = (performance as any).monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    setInterval(() => {
      const { mean, max, min, percentiles } = h;
      const eventLoopStats = {
        meanMs: mean,
        maxMs: max,
        minMs: min,
        p50Ms: percentiles.get(50),
        p99Ms: percentiles.get(99),
        timestamp: Date.now(),
      };
      metrics.eventLoopDelays.push(eventLoopStats);
      console.log({
        metric: 'event_loop_delay',
        mean: formatMs(mean),
        max: formatMs(max),
        min: formatMs(min),
        p50: formatMs(percentiles.get(50)),
        p99: formatMs(percentiles.get(99)),
        desiredRange: desiredRanges.eventLoopDelayMs,
        timestamp: Date.now(),
      });
      h.reset();
    }, interval);
  } catch {
    // older Node versions don’t support monitorEventLoopDelay
  }

  // 4) Process, OS, and handles stats
  setInterval(() => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const processStats = { memory: mem, cpu, timestamp: Date.now() };
    metrics.processStats.push(processStats);
    console.log({
      metric: 'process_stats',
      memory: Object.fromEntries(Object.entries(mem).map(([k, v]) => [k, formatBytes(v as number)])),
      cpu: cpu,
      desiredRange: { memory: desiredRanges.processMemory, cpu: desiredRanges.cpuUsage },
      timestamp: Date.now(),
    });

    // OS stats
    const osStats = {
      loadAvg: os.loadavg(),
      freeMemBytes: os.freemem(),
      totalMemBytes: os.totalmem(),
      uptimeSec: os.uptime(),
      cpuCores: os.cpus().length,
      timestamp: Date.now()
    };
    metrics.osStats.push(osStats);
    console.log({
      metric: 'os_stats',
      loadAvg: formatLoadAvg(osStats.loadAvg),
      freeMem: formatBytes(osStats.freeMemBytes),
      totalMem: formatBytes(osStats.totalMemBytes),
      uptime: `${osStats.uptimeSec.toFixed(0)} s`,
      cpuCores: osStats.cpuCores,
      desiredRange: desiredRanges.osLoadAvg,
      timestamp: Date.now(),
    });

    // Handles
    const handlesCount = (process as any)._getActiveHandles?.().length || 0;
    metrics.activeHandles.push({ count: handlesCount, timestamp: Date.now() });
    console.log({
      metric: 'handles',
      count: handlesCount,
      desiredRange: desiredRanges.activeHandles,
      timestamp: Date.now(),
    });
  }, interval);

  // 5) Error tracking
  process.on('uncaughtException', () => {
    metrics.errorCounts.uncaughtExceptions++;
  });
  process.on('unhandledRejection', () => {
    metrics.errorCounts.unhandledRejections++;
  });

  return {
    getMetrics: () => {
      const clone = JSON.parse(JSON.stringify(metrics));
      clone.httpRequests.durationsMs = clone.httpRequests.durationsMs.map(formatMs);
      clone.eventLoopDelays = clone.eventLoopDelays.map((e: { meanMs: number; maxMs: number; minMs: number; p50Ms: number; p99Ms: number; }) => ({
        ...e,
        meanMs: formatMs(e.meanMs),
        maxMs: formatMs(e.maxMs),
        minMs: formatMs(e.minMs),
        p50Ms: formatMs(e.p50Ms),
        p99Ms: formatMs(e.p99Ms),
      }));
      clone.processStats = clone.processStats.map((p: {
        memory: NodeJS.MemoryUsage;
        cpu: NodeJS.CpuUsage;
        timestamp: number;
      }) => ({
        ...p,
        memory: Object.fromEntries(
          Object.entries(p.memory).map(([k, v]: [string, number]) => [k, formatBytes(v as number)])
        ),
      }));
      clone.osStats = clone.osStats.map((o: { loadAvg: number[]; freeMemBytes: number; totalMemBytes: number; uptimeSec: number; }) => ({
        ...o,
        loadAvg: formatLoadAvg(o.loadAvg),
        freeMemBytes: formatBytes(o.freeMemBytes),
        totalMemBytes: formatBytes(o.totalMemBytes),
        uptimeSec: `${o.uptimeSec.toFixed(0)} s`,
      }));
      return clone;
    },

    summarizeMetrics: () => {
      const {
        httpRequests,
        garbageCollections,
        eventLoopDelays,
        processStats,
        osStats,
        activeHandles,
        errorCounts,
      } = metrics;

      const avg = (arr: number[]) =>
        arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

      // HTTP
      const totalReq = httpRequests.totalCount;
      const errCount = httpRequests.errorCount;
      const avgReqMs = avg(httpRequests.durationsMs);
      const errRate = totalReq ? (errCount / totalReq) * 100 : 0;
      const httpStatus =
        errRate > 5 || avgReqMs > 500 ? 'Needs attention' : 'OK';

      // GC
      const gcDurations = garbageCollections.map(g => g.durationMs);
      const avgGcMs = avg(gcDurations);
      const maxGcMs = Math.max(...gcDurations, 0);
      const gcStatus = avgGcMs > 50 ? 'GC is slow' : 'GC OK';

      // Event loop
      const lastLoop = eventLoopDelays[eventLoopDelays.length - 1] || {};
      const { mean: loopMean = 0, max: loopMax = 0 } = lastLoop as any;
      const loopStatus =
        loopMean > 50 ? 'Event-loop lag' : 'Loop OK';

      // Process / OS
      const lastProc = processStats[processStats.length - 1] || { memory: {}, cpu: {} };
      const lastOs = osStats[osStats.length - 1] || { loadAvg: [], totalMemBytes: 1 };
      const memUsage = lastProc.memory.rss;
      const cpuUser = lastProc.cpu.user + lastProc.cpu.system;
      const memPct = (memUsage / lastOs.totalMemBytes) * 100;
      const cpuPct = (cpuUser / 1e6 / os.cpus().length) * 100;
      const resourceStatus =
        memPct > 80 || cpuPct > 80 ? 'High resource use' : 'Resource use OK';

      // OS load
      const osStatus =
        lastOs.loadAvg[0] > lastOs.cpuCores ? 'Load exceeds cores' : 'OS load OK';

      // Handles
      const lastHandles = activeHandles[activeHandles.length - 1]?.count || 0;
      const handlesStatus =
        lastHandles > 1000 ? 'Too many handles' : 'Handles OK';

      // Runtime errors
      const errorSum = errorCounts.uncaughtExceptions + errorCounts.unhandledRejections;
      const errorStatus =
        errorSum > 0 ? 'Runtime errors detected' : 'No runtime errors';

      return {
        http: {
          total: totalReq,
          errors: errCount,
          errorRate: `${errRate.toFixed(1)}%`,
          avgDuration: formatMs(avgReqMs),
          status: httpStatus,
        },
        gc: {
          avgPause: formatMs(avgGcMs),
          maxPause: formatMs(maxGcMs),
          status: gcStatus,
        },
        eventLoop: {
          meanDelay: formatMs(loopMean),
          maxDelay: formatMs(loopMax),
          status: loopStatus,
        },
        process: {
          memoryUsage: formatBytes(memUsage),
          memoryPct: `${memPct.toFixed(1)}%`,
          cpuPct: `${cpuPct.toFixed(1)}%`,
          status: resourceStatus,
        },
        os: {
          loadAvg: formatLoadAvg(lastOs.loadAvg),
          freeMem: formatBytes(lastOs.freeMemBytes),
          status: osStatus,
        },
        handles: {
          current: lastHandles,
          status: handlesStatus,
        },
        errors: {
          uncaughtExceptions: errorCounts.uncaughtExceptions,
          unhandledRejections: errorCounts.unhandledRejections,
          status: errorStatus,
        }
      };
    }
  };
};

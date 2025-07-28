import { Express, Request, Response, NextFunction } from 'express';
import { performance, PerformanceObserver, monitorEventLoopDelay } from 'perf_hooks';
import os from 'os';
import { BackendMetrics } from '../types/BackendMetrics';

export function captureBackendMetrics(app: Express, opts: { statsIntervalMs?: number } = {}) {
  const interval = opts.statsIntervalMs ?? 60_000;

  const metrics: BackendMetrics = {
    httpRequests: { totalCount: 0, errorCount: 0, durationsMs: [] },
    garbageCollections: [],
    eventLoopDelays: [],
    processStats: [],
    osStats: [],
    activeHandles: [],
    errorCounts: { uncaughtExceptions: 0, unhandledRejections: 0 },
    userMetrics: { activeUsers: 0, sessionDurationMs: [], pageViews: 0, customEvents: {} },
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    res.on('finish', () => {
      const duration = performance.now() - start;
      metrics.httpRequests.totalCount++;
      metrics.httpRequests.durationsMs.push(duration);
      if (res.statusCode >= 400) {
        metrics.httpRequests.errorCount++;
      }
    });
    next();
  });

  const gcObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const detail = (entry as any).detail;
      metrics.garbageCollections.push({
        type: detail?.kind,
        durationMs: entry.duration,
        timestamp: Date.now(),
      });
    }
  });
  gcObserver.observe({ type: 'gc', buffered: true });

  const eventLoopHistogram = monitorEventLoopDelay({ resolution: 10 });
  eventLoopHistogram.enable();
  setInterval(() => {
    const { mean, max, min, percentiles } = eventLoopHistogram;
    metrics.eventLoopDelays.push({
      meanMs: mean,
      maxMs: max,
      minMs: min,
      p50Ms: percentiles.get(50) ?? 0,
      p99Ms: percentiles.get(99) ?? 0,
      timestamp: Date.now(),
    });
    eventLoopHistogram.reset();
  }, interval);

  function collectProcessAndOsStats() {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    metrics.processStats.push({ memory, cpu, timestamp: Date.now() });

    const osStats = {
      loadAvg: os.loadavg(),
      freeMemBytes: os.freemem(),
      totalMemBytes: os.totalmem(),
      uptimeSec: os.uptime(),
      cpuCores: os.cpus().length,
      timestamp: Date.now(),
    };
    metrics.osStats.push(osStats);

    const activeHandlesCount =
      typeof (process as any)._getActiveHandles === 'function'
        ? (process as any)._getActiveHandles().length
        : 0;
    metrics.activeHandles.push({ count: activeHandlesCount, timestamp: Date.now() });
  }
  collectProcessAndOsStats();
  setInterval(collectProcessAndOsStats, interval);

  process.on('uncaughtException', () => {
    metrics.errorCounts.uncaughtExceptions++;
  });
  process.on('unhandledRejection', () => {
    metrics.errorCounts.unhandledRejections++;
  });


function summarizeMetrics() {
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Summarizing HTTP request performance
  const totalReq = metrics.httpRequests.totalCount;
  const errCount = metrics.httpRequests.errorCount;
  const avgReqMs = avg(metrics.httpRequests.durationsMs);
  const errRate = totalReq ? (errCount / totalReq) * 100 : 0;
  const httpStatus = errRate > 5 || avgReqMs > 500 ? 'Needs attention' : 'OK';

  // GC performance summary
  const gcDurations = metrics.garbageCollections.map(g => g.durationMs);
  const avgGcMs = avg(gcDurations);
  const maxGcMs = gcDurations.length ? Math.max(...gcDurations) : 0;
  const gcStatus = avgGcMs > 50 ? 'GC is slow' : 'GC OK';

  // Event loop delay summary
  const lastLoop = metrics.eventLoopDelays[metrics.eventLoopDelays.length - 1] || {};
  const loopMean = lastLoop.meanMs || 0;
  const loopMax = lastLoop.maxMs || 0;
  const loopStatus = loopMean > 50 ? 'Event-loop lag' : 'Loop OK';

  // Process and OS stats summary
  const lastProc = metrics.processStats[metrics.processStats.length - 1] || { memory: { rss: 0 }, cpu: { user: 0, system: 0 } };
  const lastOs = metrics.osStats[metrics.osStats.length - 1] || { loadAvg: [0], totalMemBytes: 1, cpuCores: 1, freeMemBytes: 0 };
  
  // Memory and CPU usage summary
  const memUsage = lastProc.memory.rss;
  const memPct = lastOs.totalMemBytes ? (memUsage / lastOs.totalMemBytes) * 100 : 0;
  const cpuPct = lastOs.cpuCores ? ((lastProc.cpu.user + lastProc.cpu.system) / 1e6 / lastOs.cpuCores) * 100 : 0;
  const resourceStatus = memPct > 80 || cpuPct > 80 ? 'High resource use' : 'Resource use OK';

  // OS load summary
  const osStatus = lastOs.loadAvg[0] > lastOs.cpuCores ? 'Load exceeds cores' : 'OS load OK';
  const lastHandles = metrics.activeHandles[metrics.activeHandles.length - 1]?.count || 0;
  const handlesStatus = lastHandles > 1000 ? 'Too many handles' : 'Handles OK';

  // Error summary
  const errorSum = metrics.errorCounts.uncaughtExceptions + metrics.errorCounts.unhandledRejections;
  const errorStatus = errorSum > 0 ? 'Runtime errors detected' : 'No runtime errors';

  // User metrics summary
  const totalPageViews = metrics.userMetrics.pageViews;
  const customEvents = metrics.userMetrics.customEvents;
  const activeUsers = metrics.userMetrics.activeUsers;
  
  const userEventsSummary = Object.keys(customEvents).map(event => ({
    event,
    count: customEvents[event],
  }));

  const userMetricsStatus = totalPageViews > 0 ? 'User activity detected' : 'No user activity';

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
      loadAvg: lastOs.loadAvg.map(l => l.toFixed(2)).join(', '),
      freeMem: formatBytes(lastOs.freeMemBytes),
      status: osStatus,
    },
    handles: {
      current: lastHandles,
      status: handlesStatus,
    },
    errors: {
      uncaughtExceptions: metrics.errorCounts.uncaughtExceptions,
      unhandledRejections: metrics.errorCounts.unhandledRejections,
      status: errorStatus,
    },
    userMetrics: {
      activeUsers,
      pageViews: totalPageViews,
      customEvents: userEventsSummary,
      status: userMetricsStatus,
    },
  };
}

  return {
    getMetrics: (event?: string) => {
      if (event) {
        if (event === 'pageView') {
          metrics.userMetrics.pageViews++;
        } else {
          metrics.userMetrics.customEvents[event] = (metrics.userMetrics.customEvents[event] || 0) + 1;
        }
      }

      const clone = JSON.parse(JSON.stringify(metrics)) as any;

      clone.httpRequests.durationsMs = clone.httpRequests.durationsMs.map(formatMs);
      clone.eventLoopDelays = clone.eventLoopDelays.map((e: any) => ({
        ...e,
        meanMs: formatMs(e.meanMs),
        maxMs: formatMs(e.maxMs),
        minMs: formatMs(e.minMs),
        p50Ms: formatMs(e.p50Ms ?? 0),
        p99Ms: formatMs(e.p99Ms ?? 0),
      }));
      clone.processStats = clone.processStats.map((p: any) => ({
        ...p,
        memory: Object.fromEntries(Object.entries(p.memory).map(([k, v]) => [k, formatBytes(v as number)])),
      }));
      clone.osStats = clone.osStats.map((o: any) => ({
        ...o,
        loadAvg: o.loadAvg.map((l: number) => l.toFixed(2)),
        freeMemBytes: formatBytes(o.freeMemBytes),
        totalMemBytes: formatBytes(o.totalMemBytes),
        uptimeSec: `${o.uptimeSec.toFixed(0)} s`,
      }));

      return {
        metrics: clone as BackendMetrics,
        summary: summarizeMetrics(),
      };
    },
  };
}
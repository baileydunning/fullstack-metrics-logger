import { FrontendMetrics, FrontendMetricsOpts } from '../types/FrontendMetrics';

export function captureFrontendMetrics(opts: FrontendMetricsOpts = {}) {
  const {
    batchSize = Infinity,
    flushIntervalMs = 60_000,
    captureResources = true,
  } = opts;

  const metrics: FrontendMetrics = {
    apiCalls: [],
    loadedResources: [],
    slowTasks: [],
    javascriptErrors: [],
    coreWebVitals: {
      largestContentfulPaint: undefined,
      firstInputDelay: undefined,
      firstContentfulPaint: undefined,
      timeToFirstByte: undefined,
    },
    pageLoadTiming: undefined,
  };

  let batchCount = 0;
  const observers: PerformanceObserver[] = [];

  function markEvent() {
    batchCount++;
    if (batchCount >= batchSize) {
      batchCount = 0;
    }
  }

  function clearBatch() {
    batchCount = 0;
  }

  // Record a Core Web Vital
  function recordVital<Name extends keyof FrontendMetrics['coreWebVitals']>(
    name: Name,
    value: number
  ) {
    metrics.coreWebVitals[name] = { value, timestamp: Date.now() };
    markEvent();
  }

  // Helper to create and register a PerformanceObserver
  function observeEntry(
    type: string,
    handler: (entry: PerformanceEntry) => void
  ) {
    if (typeof PerformanceObserver === 'undefined') return;
    const obs = new PerformanceObserver(list => {
      list.getEntries().forEach(handler);
    });
    obs.observe({ entryTypes: [type] }); // Removed buffered: true to avoid warning
    observers.push(obs);
  }

  // 1) Core Web Vitals via PerformanceObserver
  observeEntry('largest-contentful-paint', (e: any) => {
    const lcpValue = e.renderTime || e.loadTime || e.startTime;
    if (!metrics.coreWebVitals.largestContentfulPaint) {
      recordVital('largestContentfulPaint', lcpValue);
    }
  });

  observeEntry('first-input', (e: any) => {
    const fid = e.processingStart - e.startTime;
    if (!('firstInputDelay' in metrics.coreWebVitals) || metrics.coreWebVitals.firstInputDelay === undefined) {
      recordVital('firstInputDelay', fid);
    }
  });

  // Immediately check for existing FCP entries in case they occurred before observer registration
  // FCP
  const fcpEntries = performance.getEntriesByName('first-contentful-paint', 'paint');
  if (fcpEntries.length > 0) {
    if (!metrics.coreWebVitals.firstContentfulPaint) {
      recordVital('firstContentfulPaint', fcpEntries[0].startTime);
    }
  } else {
    setTimeout(() => {
      const retryFcpEntries = performance.getEntriesByName('first-contentful-paint', 'paint');
      if (retryFcpEntries.length > 0 && !metrics.coreWebVitals.firstContentfulPaint) {
        recordVital('firstContentfulPaint', retryFcpEntries[0].startTime);
      }
    }, 500);
  }

  // 2) Long Tasks
  observeEntry('longtask', (e: any) => {
    metrics.slowTasks.push({
      name: e.name,
      startTime: e.startTime,
      duration: e.duration,
    });
    if (metrics.slowTasks.length > 500) metrics.slowTasks.shift();
    markEvent();
  });

  // 3) On window load: paint, navigation, resources
  window.addEventListener('load', () => {
    // Paint timings
    performance.getEntriesByType('paint').forEach(p => {
      if (p.name === 'first-contentful-paint') {
        recordVital('firstContentfulPaint', p.startTime);
      }
    });

    // Navigation timing (TTFB + full load)
    const [nav] = performance.getEntriesByType(
      'navigation'
    ) as PerformanceNavigationTiming[];
    if (nav) {
      recordVital('timeToFirstByte', nav.responseStart - nav.requestStart);
      metrics.pageLoadTiming = nav;
      markEvent();
    }

    // Resource timings
    if (captureResources) {
      performance.getEntriesByType('resource').forEach(r => {
        metrics.loadedResources.push({
          name: r.name,
          entryType: r.entryType,
          startTime: r.startTime,
          duration: r.duration,
        });
        if (metrics.loadedResources.length > 500)
          metrics.loadedResources.shift();
        markEvent();
      });
    }
  });

  // 4) JS errors & unhandled rejections
  const handleError = (e: ErrorEvent) => {
    metrics.javascriptErrors.push({
      message: e.message,
      source: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      timestamp: Date.now(),
    });
    markEvent();
  };
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const message =
      e.reason?.message ?? String(e.reason) ?? 'Unhandled Rejection';
    metrics.javascriptErrors.push({ message, timestamp: Date.now() });
    markEvent();
  });

  // 5) Auto-reset batch counter
  const resetHandle = setInterval(clearBatch, flushIntervalMs);

  function getMetrics() {
    const safeMetrics = { ...metrics };
    if (safeMetrics.pageLoadTiming) {
      // Only copy serializable properties
      safeMetrics.pageLoadTiming = { ...safeMetrics.pageLoadTiming };
    }
    const metricsClone = typeof structuredClone === 'function'
      ? structuredClone(safeMetrics)
      : JSON.parse(JSON.stringify(safeMetrics));
    return {
      metrics: metricsClone,
      summary: summarizeMetrics(),
    };
  }

  function flush() {
    const snapshot = getMetrics();
    clearBatch();
    return snapshot;
  }

  function dispose() {
    observers.forEach(o => o.disconnect());
    window.removeEventListener('error', handleError);
    window.removeEventListener(
      'unhandledrejection',
      handleError as any
    );
    clearInterval(resetHandle);
  }

  function summarizeMetrics() {
    const {
      apiCalls,
      loadedResources,
      slowTasks,
      javascriptErrors,
      coreWebVitals,
      pageLoadTiming,
    } = metrics;

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const formatMs = (ms: number) =>
      ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;

    // 1) API calls
    const apiTotal = apiCalls.length;

    // 2) Resources
    const resourceDurations = loadedResources.map(r => r.duration);
    const avgResource = avg(resourceDurations);
    const maxResource = Math.max(...resourceDurations, 0);
    const resourcesStatus =
      avgResource > 200 ? 'Resource loading is slow' : 'Resource loading OK';

    // 3) Slow tasks
    const taskDurations = slowTasks.map(t => t.duration);
    const avgTask = avg(taskDurations);
    const maxTask = Math.max(...taskDurations, 0);
    const tasksStatus =
      avgTask > 50 ? 'Slow tasks detected' : 'Slow tasks OK';

    // 4) JS errors
    const errorsTotal = javascriptErrors.length;
    const errorsStatus =
      errorsTotal > 0 ? 'Errors detected' : 'No errors';

    // 5) Core Web Vitals
    const {
      largestContentfulPaint,
      firstContentfulPaint,
      firstInputDelay,
      timeToFirstByte,
    } = coreWebVitals;

    const lcpVal = largestContentfulPaint?.value ?? 0;
    const fcpVal = firstContentfulPaint?.value ?? 0;
    const fidVal = firstInputDelay?.value ?? 0;
    const ttfbVal = timeToFirstByte?.value ?? 0;

    const vitals = {
      largestContentfulPaint: {
        value: formatMs(lcpVal),
        status: lcpVal > 2500 ? 'Needs attention' : 'OK',
      },
      firstContentfulPaint: {
        value: formatMs(fcpVal),
        status: fcpVal > 1000 ? 'Needs attention' : 'OK',
      },
      firstInputDelay: {
        value: formatMs(fidVal),
        status: fidVal > 100 ? 'Needs attention' : 'OK',
      },
      timeToFirstByte: {
        value: formatMs(ttfbVal),
        status: ttfbVal > 600 ? 'Needs attention' : 'OK',
      },
    };

    // 6) Page-load timing (if available)
    let pageLoad: {
      domContentLoaded: string;
      loadTime: string;
      status: string;
    } | null = null;

    if (pageLoadTiming) {
      const dcl = pageLoadTiming.domContentLoadedEventEnd - pageLoadTiming.startTime;
      const load = pageLoadTiming.loadEventEnd - pageLoadTiming.startTime;
      pageLoad = {
        domContentLoaded: formatMs(dcl),
        loadTime: formatMs(load),
        status: load > 3000 ? 'Page load is slow' : 'Page load OK',
      };
    }

    return {
      apiCalls: { total: apiTotal },
      resources: {
        total: resourceDurations.length,
        avgDuration: formatMs(avgResource),
        maxDuration: formatMs(maxResource),
        status: resourcesStatus,
      },
      slowTasks: {
        total: taskDurations.length,
        avgDuration: formatMs(avgTask),
        maxDuration: formatMs(maxTask),
        status: tasksStatus,
      },
      errors: {
        total: errorsTotal,
        status: errorsStatus,
      },
      coreWebVitals: vitals,
      pageLoad,
    };
  }

  return { getMetrics, flush, clearBatch, dispose };
}
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
      cumulativeLayoutShift: undefined,
      firstInputDelay: undefined,
      firstContentfulPaint: undefined,
      timeToFirstByte: undefined,
    },
    pageLoadTiming: undefined,
  };

  let batchCount = 0;
  const observers: PerformanceObserver[] = [];

  // Increment batch counter and auto-reset if threshold reached
  function markEvent() {
    batchCount++;
    if (batchCount >= batchSize) {
      batchCount = 0;
      // you could trigger an automatic flush here if desired
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
    obs.observe({ type, buffered: true });
    observers.push(obs);
  }

  // 1) Core Web Vitals via PerformanceObserver
  observeEntry('largest-contentful-paint', (e: any) => {
    recordVital('largestContentfulPaint', e.renderTime ?? e.loadTime);
  });

  let cumulativeShift = 0;
  observeEntry('layout-shift', (e: any) => {
    if (!e.hadRecentInput) {
      cumulativeShift += e.value;
      recordVital('cumulativeLayoutShift', cumulativeShift);
    }
  });

  observeEntry('first-input', (e: any) => {
    recordVital('firstInputDelay', e.processingStart - e.startTime);
  });

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

  function getMetrics(): FrontendMetrics {
    return typeof structuredClone === 'function'
      ? structuredClone(metrics)
      : JSON.parse(JSON.stringify(metrics));
  }

  function flush(): FrontendMetrics {
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

  return { getMetrics, flush, clearBatch, dispose };
}
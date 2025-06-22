export interface FrontendMetrics {
  /** How long it took for the page to fully render */
  pageLoadTiming?: PerformanceNavigationTiming;

  /** Records of API calls made by the page */
  apiCalls: {
    method: string;
    url: string;
    status: number;
    durationMs: number;
    timestamp: number;
  }[];

  /** Details of each static file loaded by the page */
  loadedResources: {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
  }[];

  /** Time-consuming JavaScript tasks that may cause jank */
  slowTasks: {
    name: string;
    startTime: number;
    duration: number;
  }[];

  /** JavaScript errors and unhandled promise rejections */
  javascriptErrors: {
    message: string;
    source?: string;
    lineno?: number;
    colno?: number;
    timestamp: number;
  }[];

  /**
   * Core user-centric performance metrics:
   * - largestContentfulPaint: Time to render the largest visible element
   * - firstContentfulPaint: Time to first pixel of content
   * - cumulativeLayoutShift: Visual stability score
   * - firstInputDelay: Delay before page responds to first user interaction
   * - timeToFirstByte: Server response latency
   */
  coreWebVitals: {
    largestContentfulPaint?: { value: number; timestamp: number };
    firstContentfulPaint?: { value: number; timestamp: number };
    cumulativeLayoutShift?: { value: number; timestamp: number };
    firstInputDelay?: { value: number; timestamp: number };
    timeToFirstByte?: { value: number; timestamp: number };
  };
}

export interface FrontendMetricsOpts {
  batchSize?: number;
  flushIntervalMs?: number;
  captureResources?: boolean;
}
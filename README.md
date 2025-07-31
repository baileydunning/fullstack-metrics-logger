# Fullstack Metrics Logger

This package is designed to enable developers to understand and monitor the real-world performance of their applications, both on the backend and frontend. It provides detailed metrics as well as high-level summaries, making it easy to spot trends, regressions, or issues in development environments.

- **Detailed Metrics:** Functions like `getMetrics()` return raw, granular data about requests, resources, errors, and more, allowing for in-depth analysis and custom reporting.
- **Summaries:** Functions like `summarizeMetrics()` (backend) and the `summary` key in frontend metrics provide a concise, human-friendly overview of the application's health. These summaries aggregate the raw data and compare it against recommended thresholds to quickly highlight potential problems.
- **Thresholds:** Each summary field uses industry best-practice thresholds (e.g., average HTTP request duration, resource load times, error rates) to determine status. If a metric exceeds its threshold, the summary will indicate that attention is needed (e.g., 'Needs attention', 'OK', etc.). These thresholds are defined in the code and can be adjusted for your use case.

## Features
- **Backend:**
  - HTTP request timing
  - Garbage collection pauses
  - Event loop delay
  - Process and OS stats
  - Active handles
  - Error tracking
  - User metrics (page views, custom events, active users)

- **Frontend:**
  - Navigation timing
  - API calls (fetch)
  - Resource timings
  - Long tasks
  - JavaScript errors and unhandled rejections
  - Core Web Vitals (LCP, FID, CLS, FCP, TTFB) via browser APIs

## Installation

```
npm install fullstack-metrics-logger
```

---

## Backend Usage (Express example)

```typescript
import express from 'express';
import { captureBackendMetrics } from 'fullstack-metrics-logger/backend';

const app = express();
const { getMetrics, summarizeMetrics } = captureBackendMetrics(app, { statsIntervalMs: 60000 });

app.get("/metrics", (_req: Request, res: Response) => {
  res.json({
    "metrics": getMetrics(),
    "summary": summarizeMetrics()
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

Example Response from `/metrics` endpoint:
```json
{
  "metrics": {
    "httpRequests": {
      "totalCount": 10,
      "errorCount": 0,
      "durationsMs": [
        "6.96 ms",
        "1.84 ms",
        "1.31 ms",
        "1.71 ms",
        "1.18 ms",
        "1.56 ms",
        "1.74 ms",
        "1.13 ms",
        "1.27 ms",
        "1.57 ms"
      ]
    },
    "garbageCollections": [
      {
        "type": 8,
        "durationMs": 0.564957976341248,
        "timestamp": 1750611082985
      },
      {
        "type": 4,
        "durationMs": 3.98787504434586,
        "timestamp": 1750611082997
      },
      {
        "type": 8,
        "durationMs": 0.463459014892578,
        "timestamp": 1750611083600
      },
      {
        "type": 4,
        "durationMs": 4.19391596317291,
        "timestamp": 1750611083615
      }
    ],
    "eventLoopDelays": [],
    "processStats": [
      {
        "memory": {
          "rss": "154.75 MB",
          "heapTotal": "31.77 MB",
          "heapUsed": "29.71 MB",
          "external": "14.94 MB",
          "arrayBuffers": "4.87 MB"
        },
        "cpu": {
          "user": 264448,
          "system": 42199
        },
        "timestamp": 1750611104931
      }
    ],
    "osStats": [
      {
        "loadAvg": "2.36, 2.27, 1.99",
        "freeMemBytes": "5.52 GB",
        "totalMemBytes": "64.00 GB",
        "uptimeSec": "499228 s",
        "cpuCores": 16,
        "timestamp": 1750611104933
      }
    ],
    "activeHandles": [
      {
        "count": 4,
        "timestamp": 1750611104933
      }
    ],
    "errorCounts": {
      "uncaughtExceptions": 0,
      "unhandledRejections": 0
    },
    "userMetrics": {
      "activeUsers": 50,
      "pageViews": 120,
      "customEvents": {
        "buttonClick": 20,
        "formSubmit": 5
      }
    }
  },
  "summary": {
    "http": {
      "total": 10,
      "errors": 0,
      "errorRate": "0.0%",
      "avgDuration": "2.03 ms",
      "status": "OK"
    },
    "gc": {
      "avgPause": "2.30 ms",
      "maxPause": "4.19 ms",
      "status": "GC OK"
    },
    "eventLoop": {
      "meanDelay": "0.00 ms",
      "maxDelay": "0.00 ms",
      "status": "Loop OK"
    },
    "process": {
      "memoryUsage": "154.75 MB",
      "memoryPct": "0.2%",
      "cpuPct": "1.9%",
      "status": "Resource use OK"
    },
    "os": {
      "loadAvg": "2.36, 2.27, 1.99",
      "freeMem": "5.52 GB",
      "status": "OS load OK"
    },
    "handles": {
      "current": 4,
      "status": "Handles OK"
    },
    "errors": {
      "uncaughtExceptions": 0,
      "unhandledRejections": 0,
      "status": "No runtime errors"
    },
    "userMetrics": {
      "activeUsers": 50,
      "pageViews": 120,
      "customEvents": [
        { "event": "buttonClick", "count": 20 },
        { "event": "formSubmit", "count": 5 }
      ],
      "status": "User activity detected"
    }
  }
}
```

---

## Frontend Usage (React example)

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { captureFrontendMetrics } from "fullstack-metrics-logger/frontend";

// start metric capture immediately
const { getMetrics, flush } = captureFrontendMetrics({
  batchSize: 2,            // flush every 2 events
  flushIntervalMs: 10_000, // or every 10s
  captureResources: true,
})

// expose for manual inspection in the console
;(window as any).getMetrics = getMetrics
;(window as any).flushMetrics = flush

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

Example Output from `getMetrics()` in the console
```json
{
    "metrics": {
        "apiCalls": [],
        "loadedResources": [
            {
                "name": "http://localhost:5173/@vite/client",
                "entryType": "resource",
                "startTime": 10.599999994039536,
                "duration": 4.9000000059604645
            },
            {
                "name": "http://localhost:5173/src/main.tsx",
                "entryType": "resource",
                "startTime": 10.799999997019768,
                "duration": 6.5
            },
            {
                "name": "http://localhost:5173/@react-refresh",
                "entryType": "resource",
                "startTime": 24.799999997019768,
                "duration": 0.9000000059604645
            },
            {
                "name": "http://localhost:5173/node_modules/vite/dist/client/env.mjs",
                "entryType": "resource",
                "startTime": 25.099999994039536,
                "duration": 1
            },
            {
                "name": "http://localhost:5173/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=97c45f58",
                "entryType": "resource",
                "startTime": 25.200000002980232,
                "duration": 0
            },
            {
                "name": "http://localhost:5173/node_modules/.vite/deps/react.js?v=97c45f58",
                "entryType": "resource",
                "startTime": 25.299999997019768,
                "duration": 0
            },
            {
                "name": "http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=97c45f58",
                "entryType": "resource",
                "startTime": 26.799999997019768,
                "duration": 0
            },
            {
                "name": "http://localhost:5173/src/App.tsx",
                "entryType": "resource",
                "startTime": 26.799999997019768,
                "duration": 0.7999999970197678
            },
            {
                "name": "http://localhost:5173/@fs/Users/baileydunning/Projects/fullstack-metrics-logger/dist/frontend/core/frontendMetrics.js",
                "entryType": "resource",
                "startTime": 26.799999997019768,
                "duration": 1.0999999940395355
            },
            {
                "name": "http://localhost:5173/node_modules/.vite/deps/chunk-UBDIXFPO.js?v=97c45f58",
                "entryType": "resource",
                "startTime": 27.099999994039536,
                "duration": 0
            },
            {
                "name": "http://localhost:5173/node_modules/.vite/deps/chunk-KBNVMJOC.js?v=97c45f58",
                "entryType": "resource",
                "startTime": 27.700000002980232,
                "duration": 0
            },
            {
                "name": "http://localhost:5173/src/App.css",
                "entryType": "resource",
                "startTime": 30.299999997019768,
                "duration": 0.7999999970197678
            }
        ],
        "slowTasks": [],
        "javascriptErrors": [],
        "coreWebVitals": {
            "largestContentfulPaint": {
                "value": 60,
                "timestamp": 1750613891855
            },
            "firstInputDelay": {
                "value": 3.7000000029802322,
                "timestamp": 1750613900935
            },
            "firstContentfulPaint": {
                "value": 60,
                "timestamp": 1750613892331
            },
            "timeToFirstByte": {
                "value": 4.800000011920929,
                "timestamp": 1750613891836
            }
        },
        "pageLoadTiming": {}
    },
    "summary": {
        "apiCalls": {
            "total": 0
        },
        "resources": {
            "total": 12,
            "avgDuration": "1.3 ms",
            "maxDuration": "6.5 ms",
            "status": "Resource loading OK"
        },
        "slowTasks": {
            "total": 0,
            "avgDuration": "0.0 ms",
            "maxDuration": "0.0 ms",
            "status": "Slow tasks OK"
        },
        "errors": {
            "total": 0,
            "status": "No errors"
        },
        "coreWebVitals": {
            "largestContentfulPaint": {
                "value": "60.0 ms",
                "status": "OK"
            },
            "firstContentfulPaint": {
                "value": "60.0 ms",
                "status": "OK"
            },
            "firstInputDelay": {
                "value": "3.7 ms",
                "status": "OK"
            },
            "timeToFirstByte": {
                "value": "4.8 ms",
                "status": "OK"
            }
        },
        "pageLoad": {
            "domContentLoaded": "36.0 ms",
            "loadTime": "42.6 ms",
            "status": "Page load OK"
        }
    }
}
```
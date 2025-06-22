# Fullstack Metrics Logger

A TypeScript/JavaScript library for collecting, batching, and exporting performance and error metrics from both backend (Node/Express) and frontend (browser) applications.

## Features
- **Backend:**
  - HTTP request timing
  - Garbage collection pauses
  - Event loop delay
  - Process and OS stats
  - Active handles
  - Error tracking

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
const { getMetrics } = captureBackendMetrics(app, { statsIntervalMs: 60000 });

app.get('/metrics', (req, res) => {
  res.json(getMetrics());
});

app.listen(3000, () => console.log('Server running on port 3000'));
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

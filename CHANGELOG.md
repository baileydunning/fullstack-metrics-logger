[1.1.0] - 2025-07-31
Introduced a new userMetrics field in the BackendMetrics interface to track user interaction data:
+ activeUsers: Estimated number of active users
+ sessionDurationMs: Array of session durations (for future use)
+ pageViews: Number of page views
+ customEvents: Custom event counters (e.g., feature usage, button clicks)

Summary Report Enhancements
+ Added a new userMetrics section in the summarized backend metrics output to surface:
+ Total page views
+ Active user count
+ Custom event tallies
+ User activity status (e.g., "User activity detected")
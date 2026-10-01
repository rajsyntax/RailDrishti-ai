# RailDrishti AI Synthetic Data Repository

This directory houses synthetic train schedules, sectional geometry, speed restrictions, and simulated historical travel metrics.

> **Notice:** Prototype mode — using simulated railway operational data. Production integration requires authorized Railway feeds.

### Data Sets
- `stations.json`: Indian Railway station master with lat/long and zone mappings.
- `train_routes.json`: Route milestones, sectional distance, normal running time.
- `historical_delays_synthetic.csv`: Simulated training features for the LightGBM ETA model.

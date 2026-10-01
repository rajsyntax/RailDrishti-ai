# RailDrishti AI — SIH Demo Checklist

Follow this checklist for a smooth Smart India Hackathon demonstration.

---

## 1. Start the Stack

```powershell
# From repo root
docker compose up --build
```

Or run locally without Docker:

```powershell
# Terminal 1 — Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### Verify Database Mode
```powershell
# Check database connectivity
curl http://localhost:8000/api/v1/health | jq '.database_connected, .redis_connected, .operating_mode'

# Expected in Docker: database_connected=true, redis_connected=true, operating_mode="database"
# Expected local without DB: database_connected=false, redis_connected=false, operating_mode="memory-only"
```

### Seed Database (Optional)
```powershell
docker compose exec backend python scripts/seed_db.py
```

---

## 2. Open Passenger Page

- Navigate to **http://localhost:5173**
- The passenger dashboard loads with 5 corridor trains displayed

---

## 3. Select Train 12952

- Click on **12952 (Mumbai Rajdhani)** in the train selection grid
- Observe:
  - Live GPS position on the corridor map
  - Current speed and section
  - Active delay indicator

---

## 4. Show ETA and Confidence Range

- In the main ETA card, point out:
  - **Scheduled Arrival** (strikethrough)
  - **Expected Arrival (P50)** — the median prediction
  - **Confidence Range (P10 – P90)** — the uncertainty band
  - **Confidence Label** — HIGH, MEDIUM, or LOW

---

## 5. Open Control Room

- Navigate to **http://localhost:5173/control**
- Observe:
  - Live corridor map with color-coded train markers
  - KPI cards (Active Trains, Delayed, High Risk, Congestion)
  - Risk Alerts panel with severity badges
  - Section Congestion breakdown

---

## 6. Inject a Signal Halt

- In the Control Room, click on a train marker or use the quick-select strip
- Use the **Demo Mode Toolbar** (if visible) or call the API:
  ```powershell
  curl -X POST http://localhost:8000/api/v1/simulate/event `
    -H "Content-Type: application/json" `
    -d '{\"event_type\":\"SIGNAL_HALT\",\"affected_train\":\"12952\",\"duration_minutes\":15,\"severity\":\"CRITICAL\"}'
  ```
- Watch the train marker turn **red** and pulse
- Observe the **SIGNAL_HALT** alert appearing in the Risk Alerts panel

---

## 7. Show ETA Change and Delay Explanation

- Navigate to **http://localhost:5173/train/12952**
- Observe:
  - Updated ETA with increased delay
  - **Explainable AI Factor Contribution Panel** showing:
    - Signal halt (+4 min)
    - Downstream congestion (+X min)
    - Timetable recovery margin (-X min)
  - Natural language summary explanation

---

## 8. Show Congestion and Propagation Effects

- In the Control Room, observe:
  - Section congestion scores updating in real-time
  - **PROPAGATION_RISK** alerts for trailing trains
  - ETA updates cascading to following trains

---

## 9. Open Station Operations Dashboard

- Navigate to **http://localhost:5173/station**
- Observe:
  - Station selector (default: KOTA)
  - KPI cards (Arrivals, Delayed, High-Risk, Platform Conflicts)
  - **Upcoming Arrivals Table** with urgency-sorted trains
  - **Platform Occupancy Gantt** with timeline blocks
  - **Action Center** with operational directives
  - **Passenger Information Board** preview

---

## 10. Show Platform/Action Updates

- Click on a train in the arrivals table to open the **Train Detail Drawer**
- Observe live telemetry, ETA forecast, and delay attribution
- Use the **Platform Reassignment** feature to resolve conflicts

---

## 11. Reset Simulation

- Call the reset endpoint:
  ```powershell
  curl -X POST http://localhost:8000/api/v1/simulate/reset
  ```
- All trains return to seed positions
- All alerts and congestion overrides are cleared

---

## 12. Backup Presentation Notes

- See `presentation/sih-deck-notes.md` for detailed talking points
- See `docs/architecture.md` for system design details

---

## 13. Verify New Features (Optional)

### Data Source Status Panel
- Navigate to **http://localhost:5173/admin**
- Observe **Data Source Status** panel showing:
  - Source Mode (SIMULATOR/LIVE_API/HYBRID)
  - Database/Redis connection status
  - Active source and last external fetch

### Source Badges
- Check **Passenger**, **Control**, and **Admin** pages for source badges:
  - `Prototype Simulation Data` (SIMULATOR mode)
  - `Live Third-Party Train Status` (LIVE_API mode)
  - `Hybrid API + Simulator` (HYBRID mode)

### External Feed Status
- Navigate to **http://localhost:8000/docs** → External Data Feed
- Check **GET /external-feed/status** for polling status
- If configured, test **POST /external-feed/trains/{train_number}/refresh**

### Fallback Demo Path
If PostgreSQL/Redis/External API is unavailable:
1. Backend logs "Database unavailable — running in memory-only mode"
2. All dashboards continue working with simulator data
3. Health endpoint shows `operating_mode: "memory-only"`
4. Source badges show `Prototype Simulation Data`

# RailDrishti AI

> **Dynamic ETA Forecasting and Railway Operations Intelligence for Coaching Trains**

---

## SIH Problem Relevance

RailDrishti AI addresses the Smart India Hackathon challenge of leveraging AI/ML for Indian Railways operational efficiency. The platform provides dynamic ETA forecasting, explainable delay reasoning, congestion intelligence, and decision-support dashboards for passengers, station operators, and control-room staff — all critical pain points in India's railway network.

---

## Key Features

- **Simulated Real-Time Train Movement** — Kinematic simulator updates train positions every 5 seconds across the NDLS–MMCT corridor
- **Dynamic Multi-Station ETA** — Probabilistic arrival predictions for every upcoming station
- **P10/P50/P90 Confidence Intervals** — Statistical bounds on arrival times with confidence labels (HIGH/MEDIUM/LOW)
- **Explainable Delay Reasoning** — Natural language explanations of delay factors (signal halt, congestion, weather, speed restrictions, propagation)
- **Congestion Scoring** — 4-factor composite score: occupancy, trains ahead, headway risk, restriction severity
- **Delay Propagation Alerts** — 6-category alert system (ETA_CHANGED, SIGNAL_HALT, HIGH_CONGESTION, PROPAGATION_RISK, GPS_STALE, PLATFORM_PREPARATION)
- **Passenger Dashboard** — Live train tracking, ETA cards, station progression timeline, bilingual (EN/HI) support
- **Station Operations Dashboard** — Platform occupancy Gantt, action center, passenger information board preview
- **Control-Room Dashboard** — Live corridor map, risk alerts, KPI cards, train telemetry table
- **Hybrid ML + Rule-Based ETA** — LightGBM quantile regressors with physics-based fallback

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Leaflet, Recharts |
| Backend | Python 3.11+, FastAPI, Uvicorn, SQLAlchemy async, Pydantic |
| ML | LightGBM, scikit-learn, HistGradientBoosting, quantile regression |
| Database | PostgreSQL + PostGIS (optional; in-memory fallback) |
| Cache | Redis (optional) |
| Real-time | WebSocket (5-second broadcast loop) |
| Deployment | Docker Compose (backend, frontend, PostgreSQL, Redis) |

---

## Architecture Overview

```
Client Browsers
    │
    ▼
Frontend (Vite + React + TypeScript)
    │  REST + WebSocket
    ▼
FastAPI Backend (Python 3.11+)
    ├── Train Simulator Loop (every 5 s, asyncio background task)
    ├── In-Memory State Store  ←→  [Optional] Redis Cache
    ├── REST APIs (/api/v1/*)
    ├── WebSocket (/ws/live-updates)
    ├── ML Hybrid Predictor (LightGBM + rule-based fallback)
    └── [Optional] PostgreSQL via SQLAlchemy async
```

**Graceful fallback:** the backend starts in **memory-only mode** when PostgreSQL is unreachable (no Docker needed for local development).

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```powershell
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# (Optional) copy and edit environment file
copy ..\.env.example .env

# Start the dev server – simulator loop starts automatically
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server starts without PostgreSQL — it logs:
```
⚠️  Database unavailable … Running in memory-only mode.
```
All APIs are fully functional in memory-only mode.

Visit **http://localhost:8000/docs** for the interactive Swagger UI.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**.

---

## Docker Compose Setup

```powershell
# From repo root
docker compose up --build
```

| Service  | URL                     |
|----------|-------------------------|
| Backend  | http://localhost:8000   |
| Frontend | http://localhost:5173   |
| Postgres | localhost:5432          |
| Redis    | localhost:6379          |

---

## API Documentation

Interactive Swagger UI: **http://localhost:8000/docs**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | System health and mode status |
| `GET` | `/api/v1/trains` | Live state for all 5 active trains |
| `GET` | `/api/v1/trains/{train_id}/live` | Single train real-time telemetry |
| `GET` | `/api/v1/trains/{train_id}/route` | Route stations + section metrics |
| `GET` | `/api/v1/trains/{train_id}/upcoming-stations` | Upcoming stops with scheduled arrival |
| `GET` | `/api/v1/trains/{train_id}/eta` | Full dynamic ETA intelligence (P10/P50/P90, confidence, factors) |
| `GET` | `/api/v1/trains/{train_id}/explain` | Explainable AI delay factor attribution |
| `GET` | `/api/v1/sections` | All 8 corridor rail sections |
| `GET` | `/api/v1/sections/{id}` | Section metrics |
| `GET` | `/api/v1/sections/{id}/congestion` | Real-time congestion score & 4-factor breakdown |
| `GET` | `/api/v1/alerts` | Real-time control room alerts |
| `POST`| `/api/v1/simulate/reset` | Reset simulation to seed state |
| `GET` | `/api/v1/stations` | All 9 corridor stations |
| `GET` | `/api/v1/stations/{code}` | Station detail |
| `GET` | `/api/v1/stations/{code}/arrivals` | Scheduled arrivals at station |
| `WS`  | `/ws/live-updates` | Multi-channel real-time feed |

---

## Demo Scenario Flow

1. Open **http://localhost:5173** (Passenger Dashboard)
2. Select Train 12952 (Mumbai Rajdhani) — observe live position, speed, and delay
3. View dynamic ETA with P10/P50/P90 confidence range for any station
4. Navigate to **Control Center** — observe live corridor map with train markers
5. Inject a **Signal Halt** event — watch ETA update and delay explanation change
6. Observe **congestion propagation** — trailing trains receive secondary delay alerts
7. Navigate to **Station Operations** — view platform Gantt, action cards, and PIDS preview
8. **Reset simulation** to restore nominal operations

---

## Production Roadmap

- Integration with authorized Indian Railways data feeds (RTIS, COA, NTES)
- Redis-backed session and state management
- Horizontal scaling with Kubernetes
- Mobile application (React Native)
- SMS/WhatsApp notification gateway integration
- Historical analytics and trend reporting

---

## Team Members

| Role | Name |
|------|------|
| Team Lead | _[Name Placeholder]_ |
| Backend Developer | _[Name Placeholder]_ |
| Frontend Developer | _[Name Placeholder]_ |
| ML Engineer | _[Name Placeholder]_ |
| UI/UX Designer | _[Name Placeholder]_ |

---

> **Prototype Mode: This project uses synthetic and simulated railway operational data. It does not access live RTIS, COA, NTES, signalling, or other protected Indian Railways systems. Production integration requires authorized Railway feeds.**

# RailDrishti AI

> **Dynamic ETA Forecasting and Railway Operations Intelligence for Coaching Trains**

RailDrishti AI is an explainable, real-time ETA intelligence platform for Indian Railway coaching trains. It transforms simulated live train movement, historical sectional patterns, operational events, congestion, restrictions, and weather conditions into dynamic station-wise ETA forecasts, confidence ranges, delay explanations, and actionable operational alerts.

> **Prototype Mode:** This project uses synthetic and simulated railway operational data. It does not access live RTIS, COA, NTES, signalling, passenger, or other protected Indian Railways systems. Production integration requires authorized Railway feeds.

---

## Problem Statement

Traditional timetable-based ETA estimates often do not reflect actual railway operating conditions. Train arrival time can change due to:

- Signal halts and unscheduled stops
- Downstream congestion and low headway
- Temporary speed restrictions
- Rain, fog, and weather-related speed reductions
- Extended station dwell time
- Maintenance blocks
- Platform conflicts
- Cascading delays from preceding trains

These uncertainties affect passengers, station staff, platform planning, crew coordination, cleaning operations, catering, feeder transport, and control-room decision-making.

---

## Our Solution

RailDrishti AI predicts the **expected arrival time at every upcoming station**, not only at the destination. It continuously recalculates ETA whenever a train moves, slows, halts, faces congestion, or encounters an operational event.

Instead of showing only:

```text
Train delayed by 21 minutes
```

RailDrishti AI provides:

```text
Expected arrival: 18:46
Expected range: 18:42–18:54
Confidence: High
Main cause: Signal halt and moderate congestion in the next section
Recovery potential: 4–7 minutes later in the journey
```

---

## Key Features

| Feature | Description |
|---|---|
| Real-time train simulation | Kinematic simulator updates GPS-like train position, speed, delay, and status every 5 seconds |
| Dynamic multi-station ETA | Predicts arrival time for every upcoming station |
| P10/P50/P90 confidence range | Shows optimistic, expected, and conservative arrival estimates |
| Explainable delay reasoning | Converts ETA factors into simple natural-language explanations |
| Congestion intelligence | Uses occupancy, trains ahead, headway risk, and restriction severity |
| Delay propagation | Predicts secondary delay risk for trains following a delayed train |
| Passenger dashboard | Live train tracking, ETA cards, route timeline, alerts, and EN/HI interface |
| Station operations dashboard | Dynamic arrivals, platform occupancy Gantt, action center, and PIDS preview |
| Control-room dashboard | Live corridor map, risk alerts, train telemetry, congestion view, and disruption simulator |
| Hybrid ETA prediction | ML-based ETA prediction with operational rule-based fallback |
| Real-time updates | WebSocket updates every 5 seconds, with polling fallback |
| Resilient demo mode | In-memory mode works even if PostgreSQL or Redis is unavailable |

---

## System Architecture

```text
                         ┌──────────────────────────────┐
                         │  Train Movement Simulator    │
                         │  GPS | Speed | Delay | Status│
                         └──────────────┬───────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         │                              │                              │
         ▼                              ▼                              ▼
┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
│ Route & Schedule   │        │ Operational Events │        │ Historical Runs    │
│ Stations | Sections│        │ Halt | TSR | Rain  │        │ Delays | Run Times │
└──────────┬─────────┘        └──────────┬─────────┘        └──────────┬─────────┘
           └─────────────────────────────┼─────────────────────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │ Real-Time Feature Engine         │
                        │ Speed | Distance | Dwell | Events│
                        │ Traffic | Weather | Restrictions │
                        └──────────────┬──────────────────┘
                                       ▼
                        ┌─────────────────────────────────┐
                        │ Hybrid ETA Intelligence Engine  │
                        │ Rules + ML + Operational Limits │
                        │ P10/P50/P90 + Explanation       │
                        └──────────────┬──────────────────┘
                                       ▼
          ┌────────────────────────────┼────────────────────────────┐
          ▼                            ▼                            ▼
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ Passenger Dashboard  │    │ Station Operations   │    │ Control Center       │
│ ETA | Alerts | Map   │    │ Platform | Actions   │    │ Risk | Congestion    │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Mapping | Leaflet, OpenStreetMap |
| Charts | Recharts |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic |
| Database | PostgreSQL + PostGIS, with in-memory fallback |
| Cache | Redis, optional for prototype mode |
| Real-time | WebSocket updates with polling fallback |
| Machine Learning | LightGBM, scikit-learn, quantile regression |
| Deployment | Docker, Docker Compose |
| Testing | API assertions, TypeScript validation, production frontend build |

---

## ETA Prediction Approach

RailDrishti AI uses a hybrid approach that combines dynamic operational logic with machine-learning-based prediction.

```text
Sectional baseline travel time
        +
Current train speed and remaining distance
        +
Congestion and traffic impact
        +
Signal halt / weather / speed restriction impact
        +
Historical sectional running behaviour
        -
Available timetable recovery margin
        =
Dynamic ETA for upcoming stations
```

### Effective speed model

\[
V_{\text{effective}} =
V_{\text{base}}
\times W_{\text{traffic}}
\times W_{\text{weather}}
\times W_{\text{restriction}}
\times W_{\text{event}}
\]

### Congestion score

\[
CongestionScore =
0.35 \times Occupancy +
0.25 \times TrainsAhead +
0.20 \times LowHeadwayRisk +
0.20 \times RestrictionSeverity
\]

| Score | Congestion Level | UI Color |
|---:|---|---|
| 0.00–0.30 | Low | Green |
| 0.31–0.60 | Moderate | Amber |
| 0.61–1.00 | High | Red |

---

## Dashboard Modules

### Passenger Dashboard

- Search and select active train
- Live GPS-like train position and running status
- Current speed, current section, and delay
- Dynamic ETA for selected station
- Scheduled time versus expected time
- P10/P50/P90 confidence range
- ETA confidence label: High, Medium, or Low
- Delay trend: Improving, Stable, or Worsening
- Plain-language delay explanation
- Train route timeline and map
- EN/HI language support

### Control Center

- Live railway corridor map
- Color-coded moving train markers
- Active train, delayed train, high-risk train, and congestion KPIs
- Real-time alerts
- Congestion score by railway section
- Delay-propagation risk for following trains
- Train detail side panel
- Disruption simulation panel

Supported simulated events:

- Signal halt
- Temporary speed restriction
- Heavy rain
- Congestion
- Unscheduled stop
- GPS outage
- Delay recovery scenario

### Station Operations Dashboard

- Dynamic upcoming arrival board
- High-risk and delayed train identification
- Platform occupancy Gantt timeline
- Platform conflict indicators
- Action center for station teams
- Passenger Information Display System preview
- Recommended actions for platform preparation, cleaning, passenger display, and feeder transport

---

## Quick Start

### Prerequisites

```text
Python 3.11+
Node.js 18+
Docker Desktop (recommended but optional)
```

---

## Run With Docker Compose

```powershell
git clone [https://github.com/rajsyntax/RailDrishti-ai.git](https://github.com/rajsyntax/RailDrishti-ai.git)
cd RailDrishti-ai

docker compose up --build
```

Open the following services:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger API Documentation | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Run Locally

### Backend

```powershell
cd backend

python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

copy ..\.env.example .env

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend can run in memory-only mode when PostgreSQL is not available.

```text
Database unavailable — running in memory-only mode.
```

### Frontend

Open a new terminal window:

```powershell
cd frontend

npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## API Reference

Interactive Swagger API documentation:

```text
http://localhost:8000/docs
```

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | System health and current operating mode |
| `GET` | `/api/v1/trains` | Live state of all active trains |
| `GET` | `/api/v1/trains/{train_id}/live` | Current train telemetry |
| `GET` | `/api/v1/trains/{train_id}/route` | Route stations and section details |
| `GET` | `/api/v1/trains/{train_id}/upcoming-stations` | Upcoming train stops |
| `GET` | `/api/v1/trains/{train_id}/eta` | Dynamic ETA prediction with P10/P50/P90 |
| `GET` | `/api/v1/trains/{train_id}/explain` | ETA factor attribution |
| `GET` | `/api/v1/sections` | All railway sections |
| `GET` | `/api/v1/sections/{section_id}` | Railway section details |
| `GET` | `/api/v1/sections/{section_id}/congestion` | Section congestion score and factors |
| `GET` | `/api/v1/alerts` | Real-time passenger and operations alerts |
| `GET` | `/api/v1/stations` | Station directory |
| `GET` | `/api/v1/stations/{station_code}` | Station details |
| `GET` | `/api/v1/stations/{station_code}/arrivals` | Station arrival forecasts |
| `POST` | `/api/v1/simulate/reset` | Reset simulator to baseline state |
| `WS` | `/ws/live-updates` | Live train, ETA, congestion, and alert updates |

---

## SIH Demo Flow

1. Open the Passenger Dashboard.
2. Select **Train 12952 — Mumbai Rajdhani**.
3. Show current train location, speed, delay, ETA, and confidence range.
4. Open the Control Center.
5. Inject a **Signal Halt** event on the upcoming railway section.
6. Show the dynamic ETA update and increased arrival uncertainty.
7. Show the explainable delay factors.
8. Show congestion score and secondary delay risk for trailing trains.
9. Open the Station Operations Dashboard.
10. Show the updated dynamic arrival, platform Gantt, action center, and PIDS preview.
11. Reset simulation to return to baseline state.

For a detailed demonstration checklist, see:

```text
docs/demo-checklist.md
```

---

## Validation and Reliability

The prototype has been validated through:

- Backend API assertion tests
- FastAPI endpoint validation
- TypeScript static type validation
- Frontend production build validation
- WebSocket real-time update checks
- In-memory database fallback tests
- Simulator workflow tests
- Dynamic ETA, confidence, explanation, congestion, and alert tests

> Model accuracy metrics should be described as prototype validation on simulated or historical-like data unless evaluated on authorized Indian Railways operational data.

---

## Production Roadmap

| Phase | Scope |
|---|---|
| Pilot | Authorized RTIS/REMMLOT location feeds, COA movement events, timetable and route master integration |
| Prediction improvement | Historical train records, traffic occupancy, restrictions, weather, and disruption data |
| Operational rollout | Station displays, control-room dashboards, mobile APIs, and platform planning integration |
| Scale | Event streaming, Redis cache, zone-wise deployment, model monitoring |
| Passenger communication | SMS, WhatsApp, push notifications, regional-language messages |
| Continuous improvement | ETA accuracy monitoring, model drift detection, periodic retraining |

---

## Responsible Use

RailDrishti AI is a **decision-support platform**, not a safety-critical railway dispatching or signalling system.

- It does not issue train movement authority.
- It does not replace station masters, controllers, or signalling systems.
- Human railway operators retain all safety and operational decisions.
- ETA forecasts include uncertainty to prevent false precision.
- Production deployment requires authorized data access, security controls, audit logs, role-based access, and Railway approval.

---

## Team

| Role | Name |
|---|---|
| Team Lead | _Rajesh Kumar_ |
| Backend Developer | _Madhav_ |
| Frontend Developer | _Chandrama Kumar_ |
| ML Engineer | _Saumya Sachin_ |
| UI/UX Designer | _Sneha Jogi_ |
| Data and Simulation Engineer | _Nitil Kumar_ |

---

## Repository

- GitHub: https://github.com/rajsyntax/RailDrishti-ai
- Stable development branch: `main`
- SIH demo branch: `demo-safe`
- Demo release tag: `v1.0-demo`

---

## Disclaimer

This project is a Smart India Hackathon prototype created for demonstration and evaluation. All location, train movement, timetable, operational-event, congestion, weather, and historical-running data used by this project is synthetic or simulated. No live RTIS, COA, NTES, signalling, passenger, or protected Indian Railways operational system is accessed.

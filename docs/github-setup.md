# RailDrishti AI — GitHub Setup Guide

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable development branch |
| `demo-safe` | Final SIH demo branch (tagged `v1.0-demo`) |

---

## Basic Git Commands

```powershell
# Check status
git status

# Stage all changes
git add .

# Commit with a message
git commit -m "your commit message"

# Push to remote
git push
```

---

## Clone and Run from a Fresh System

```powershell
# Clone the repository
git clone https://github.com/YOUR_USERNAME/raildrishti-ai.git
cd raildrishti-ai

# Run with Docker Compose (recommended)
docker compose up --build

# Or run locally:
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Docker Run Command

```powershell
docker compose up --build
```

---

## Tagging a Demo Release

```powershell
# Create an annotated tag
git tag -a v1.0-demo -m "SIH demo-ready RailDrishti AI prototype"

# Push the tag
git push origin v1.0-demo
```

---

## Security Rules

- **Never upload `.env` files** — they contain database credentials and secrets
- **Never commit** `node_modules/`, `venv/`, `__pycache__/`, `dist/`, `build/`
- **Never commit** private keys, certificates, tokens, or passwords
- The `.gitignore` file is pre-configured to exclude all sensitive paths
- Use `.env.example` as a template — copy it to `.env` and fill in real values locally

---

## Creating the Repository on GitHub

1. Go to **https://github.com/new**
2. Repository name: `raildrishti-ai`
3. Description: `AI-powered dynamic ETA forecasting, delay explanation, and congestion intelligence for Indian Railway coaching trains.`
4. Visibility: **Public** (for SIH submission)
5. **IMPORTANT:** Do NOT initialize with README, .gitignore, or license
6. Click **Create repository**
7. Copy the HTTPS URL: `https://github.com/YOUR_USERNAME/raildrishti-ai.git`

---

## Pushing to GitHub

```powershell
# Add the remote (only once)
git remote add origin https://github.com/YOUR_USERNAME/raildrishti-ai.git

# Push main branch
git push -u origin main

# Push the demo tag
git push origin v1.0-demo

# Push the demo-safe branch
git push -u origin demo-safe
```

# 🛡️ STLA Guardian AI — Smart Connected Diagnostics Platform

**Team Falcons | Stellantis IGNITE | CON-01**

A realistic car dashboard UI with AI-powered vehicle diagnostics. Simulates faults, streams telemetry, uses Gemini AI to diagnose issues blindly from sensor data, initiates Twilio voice calls with engineers, and automatically resolves or escalates incidents — all in real time.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** installed
- **Gemini API Key** (get one at [aistudio.google.com](https://aistudio.google.com))
- **Twilio credentials** (optional — app uses simulated calls if not configured)

### 1. Clone & Setup Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY at minimum
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Open Dashboard

Navigate to **http://localhost:5173** in your browser.

---

## 🎬 Demo Script (For Judges)

### Quick Demo (2 minutes)
1. Open the dashboard — show the instrument cluster with all-green gauges
2. Click **"Test Demo"** — this triggers a Coolant System Breakdown
3. Watch the gauges react in real time (temperature rises, coolant pressure drops)
4. Switch to **Timeline** tab — see the incident unfold step by step
5. Switch to **Voice Panel** — watch the AI call the engineer and discuss the diagnosis
6. The AI determines the issue is auto-fixable → gauges normalize → incident resolves

### Full Demo (5 minutes)
1. Run the Quick Demo above (auto-fixable path)
2. Click **"Reset Demo"**
3. Click **"Engine Fault"** — watch RPM spike, oil pressure crash, vibration increase
4. The AI diagnoses it as an engine mechanical failure (non-auto-fixable)
5. After the call, the system escalates to **Mechanic/ETA View** with nearby service centers
6. Click **"Reset Demo"**
7. Click **"Electrical Short"** — watch voltage collapse, current spike, battery drain
8. Show the **System Logs** tab for raw telemetry data stream

---

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────┐
│  Dashboard   │◄──►│  Express + WS    │◄──►│  Gemini AI    │
│  (React)     │    │  Backend         │    │  Diagnosis    │
└─────────────┘    └──────┬───────────┘    └───────────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
          ┌─────┴─────┐   ┌────────┴────────┐
          │ Telemetry  │   │  Twilio Voice   │
          │ Simulator  │   │  Two-Way Call   │
          └───────────┘   └─────────────────┘
```

**Flow:** Fault Button → Telemetry Simulator (2s intervals) → Anomaly Detection → Incident Created → Gemini Diagnosis (blind, no fault label) → Twilio Call → Engineer Conversation → Resolution Decision → Auto-Fix or Mechanic Dispatch

---

## 📁 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/simulate-fault` | Start fault simulation (type: engine\|electrical\|coolant) |
| GET | `/telemetry/stream` | Get current telemetry snapshot |
| POST | `/diagnose` | Manually trigger AI diagnosis |
| POST | `/call-engineer` | Initiate Twilio voice call |
| POST | `/twilio/voice` | TwiML webhook — initial voice |
| POST | `/twilio/gather` | TwiML webhook — speech input |
| POST | `/twilio/status` | Call status callback |
| POST | `/resolve` | Trigger resolution (action: auto-fix\|escalate) |
| GET | `/incident` | Get current incident state |
| POST | `/reset` | Reset all state |
| POST | `/test-demo` | Start scripted demo flow |

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes* | Google Gemini API key for AI diagnosis |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID for real voice calls |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio phone number to call from |
| `TWILIO_TO_NUMBER` | No | Engineer's phone number to call |
| `TWILIO_WEBHOOK_BASE_URL` | No | Public URL for Twilio webhooks (use ngrok) |
| `PORT` | No | Backend port (default: 3001) |

*Without a Gemini API key, the system uses intelligent fallback heuristics for diagnosis.

---

## 🧠 Key Design Decisions

- **Blind Diagnosis**: The AI receives only raw sensor values — never the fault type. It must deduce the root cause purely from telemetry patterns.
- **Graceful Degradation**: Works without Gemini (heuristic fallback) and without Twilio (simulated calls with realistic timing/transcript).
- **Real-time Everything**: Socket.IO pushes all state changes — telemetry, incidents, transcript, logs — to the dashboard instantly.
- **Three Resolution Paths**: Coolant (auto-fixable) → auto-resolves. Engine (mechanical) → mechanic dispatch. Electrical (short circuit) → mechanic dispatch.

---

## 📋 Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion + Lucide Icons + Zustand
- **Backend**: Node.js + Express + Socket.IO
- **AI**: Google Gemini 2.0 Flash
- **Voice**: Twilio Voice API (two-way)
- **State**: Zustand (frontend) + In-memory JSON (backend)

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { SimulatorService } = require('./services/simulator');
const { AnomalyDetector } = require('./services/anomalyDetector');
const { IncidentManager } = require('./services/incidentManager');
const { GeminiDiagnosis } = require('./services/geminiDiagnosis');
const { TwilioCallService } = require('./services/twilioCall');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Services ──────────────────────────────────────────────
const simulator = new SimulatorService();
const anomalyDetector = new AnomalyDetector();
const incidentManager = new IncidentManager(io);
const gemini = new GeminiDiagnosis();
const twilioService = new TwilioCallService(io, incidentManager);

// ── Telemetry state ───────────────────────────────────────
let telemetryHistory = [];
let telemetryInterval = null;
let currentFaultType = null;
let demoMode = false;
let systemLogs = [];

function addLog(category, message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    category,
    message,
    data
  };
  systemLogs.push(entry);
  if (systemLogs.length > 500) systemLogs = systemLogs.slice(-500);
  io.emit('log', entry);
}

// ── Socket.IO ─────────────────────────────────────────────
io.on('connection', (socket) => {
  addLog('system', 'Dashboard client connected');
  // Send current state on connect
  socket.emit('telemetry-history', telemetryHistory.slice(-30));
  socket.emit('incident', incidentManager.getIncident());
  socket.emit('logs-history', systemLogs.slice(-100));
});

// ── API Routes ────────────────────────────────────────────

// POST /simulate-fault — Start a fault simulation
app.post('/simulate-fault', async (req, res) => {
  const { type } = req.body; // engine | electrical | coolant
  if (!['engine', 'electrical', 'coolant'].includes(type)) {
    return res.status(400).json({ error: 'Invalid fault type. Use: engine, electrical, coolant' });
  }

  // Clear any existing simulation
  stopSimulation();

  currentFaultType = type;
  telemetryHistory = [];
  addLog('telemetry', `Fault simulation started: ${type}`);

  // Create initial incident
  incidentManager.createIncident(type);

  // Start telemetry streaming every 2 seconds
  let tick = 0;
  telemetryInterval = setInterval(async () => {
    tick++;
    const reading = simulator.generateReading(type, tick);
    telemetryHistory.push(reading);
    if (telemetryHistory.length > 100) telemetryHistory.shift();

    io.emit('telemetry', reading);
    addLog('telemetry', `Sensor reading #${tick}`, reading);

    // Run anomaly detection
    const anomalies = anomalyDetector.detect(reading);
    if (anomalies.length > 0) {
      io.emit('anomalies', anomalies);
      addLog('anomaly', `Anomalies detected: ${anomalies.map(a => a.parameter).join(', ')}`, anomalies);

      // Auto-trigger diagnosis after enough anomalous readings (tick >= 3)
      if (tick >= 3 && incidentManager.getIncident()?.status === 'detected') {
        incidentManager.updateStatus('diagnosing');
        addLog('ai', 'Triggering AI diagnosis from telemetry...');

        try {
          const diagnosis = await gemini.diagnoseFromTelemetry(telemetryHistory);
          incidentManager.setDiagnosis(diagnosis);
          addLog('ai', 'Diagnosis complete', diagnosis);
          io.emit('diagnosis', diagnosis);

          // Auto-trigger call after diagnosis
          setTimeout(async () => {
            if (incidentManager.getIncident()?.status === 'diagnosed') {
              await initiateCallFlow();
            }
          }, 2000);
        } catch (err) {
          addLog('error', `Diagnosis failed: ${err.message}`);
          // Use fallback diagnosis
          const fallback = gemini.getFallbackDiagnosis(telemetryHistory);
          incidentManager.setDiagnosis(fallback);
          io.emit('diagnosis', fallback);
          addLog('ai', 'Using fallback diagnosis', fallback);
          setTimeout(async () => {
            if (incidentManager.getIncident()?.status === 'diagnosed') {
              await initiateCallFlow();
            }
          }, 2000);
        }
      }
    }
  }, 2000);

  res.json({ success: true, faultType: type, message: `Simulation started for ${type} fault` });
});

// GET /telemetry/stream — Current telemetry snapshot
app.get('/telemetry/stream', (req, res) => {
  res.json({
    current: telemetryHistory[telemetryHistory.length - 1] || null,
    history: telemetryHistory.slice(-30),
    faultType: currentFaultType
  });
});

// POST /diagnose — Manual diagnosis trigger
app.post('/diagnose', async (req, res) => {
  if (telemetryHistory.length === 0) {
    return res.status(400).json({ error: 'No telemetry data available' });
  }

  incidentManager.updateStatus('diagnosing');
  try {
    const diagnosis = await gemini.diagnoseFromTelemetry(telemetryHistory);
    incidentManager.setDiagnosis(diagnosis);
    io.emit('diagnosis', diagnosis);
    addLog('ai', 'Manual diagnosis complete', diagnosis);
    res.json(diagnosis);
  } catch (err) {
    const fallback = gemini.getFallbackDiagnosis(telemetryHistory);
    incidentManager.setDiagnosis(fallback);
    io.emit('diagnosis', fallback);
    addLog('ai', 'Using fallback diagnosis', fallback);
    res.json(fallback);
  }
});

// POST /call-engineer — Initiate Twilio call
app.post('/call-engineer', async (req, res) => {
  await initiateCallFlow();
  res.json({ success: true, message: 'Call initiated' });
});

async function initiateCallFlow() {
  incidentManager.updateStatus('calling');
  addLog('call', 'Initiating call to on-call engineer...');

  const incident = incidentManager.getIncident();
  const diagnosis = incident?.diagnosis;

  try {
    await twilioService.initiateCall(diagnosis, telemetryHistory);
    addLog('call', 'Call connected');
  } catch (err) {
    addLog('call', `Twilio call failed, using simulated call: ${err.message}`);
    // Run simulated call
    await twilioService.simulateCall(diagnosis, telemetryHistory);
  }
}

// POST /twilio/voice — TwiML webhook for initial voice
app.post('/twilio/voice', (req, res) => {
  const twiml = twilioService.generateInitialTwiML();
  res.type('text/xml');
  res.send(twiml);
});

// POST /twilio/gather — Handle engineer speech input
app.post('/twilio/gather', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  addLog('call', `Engineer said: ${speechResult}`);

  const twiml = await twilioService.handleEngineerSpeech(speechResult);
  res.type('text/xml');
  res.send(twiml);
});

// POST /twilio/status — Call status callback
app.post('/twilio/status', (req, res) => {
  const status = req.body.CallStatus;
  addLog('call', `Call status: ${status}`);
  twilioService.handleCallStatus(status);
  res.sendStatus(200);
});

// POST /resolve — Trigger resolution
app.post('/resolve', async (req, res) => {
  const { action } = req.body; // 'auto-fix' or 'escalate'
  const incident = incidentManager.getIncident();

  if (action === 'auto-fix') {
    incidentManager.updateStatus('resolving');
    addLog('resolution', 'Auto-fix initiated, normalizing telemetry...');

    // Gradually normalize telemetry
    let normTick = 0;
    const normInterval = setInterval(() => {
      normTick++;
      const reading = simulator.generateNormalReading(normTick);
      telemetryHistory.push(reading);
      io.emit('telemetry', reading);
      addLog('telemetry', `Recovery reading #${normTick}`, reading);

      if (normTick >= 4) {
        clearInterval(normInterval);
        incidentManager.updateStatus('resolved');
        addLog('resolution', 'Incident auto-resolved. Systems nominal.');
        stopSimulation();
      }
    }, 1500);

    res.json({ success: true, action: 'auto-fix', message: 'Auto-fix in progress' });
  } else if (action === 'escalate') {
    incidentManager.updateStatus('escalated');
    const mechanics = getMechanicsList();
    incidentManager.setMechanics(mechanics);
    io.emit('mechanics', mechanics);
    addLog('resolution', 'Escalated to field mechanic', mechanics);
    stopSimulation();
    res.json({ success: true, action: 'escalate', mechanics });
  } else {
    res.status(400).json({ error: 'Invalid action. Use: auto-fix or escalate' });
  }
});

// GET /incident — Current incident state
app.get('/incident', (req, res) => {
  res.json(incidentManager.getIncident());
});

// POST /reset — Reset everything
app.post('/reset', (req, res) => {
  stopSimulation();
  telemetryHistory = [];
  currentFaultType = null;
  demoMode = false;
  incidentManager.reset();
  systemLogs = [];
  io.emit('reset', {});
  addLog('system', 'System reset complete');
  res.json({ success: true, message: 'System reset' });
});

// POST /test-demo — Scripted demo flow
app.post('/test-demo', async (req, res) => {
  demoMode = true;
  res.json({ success: true, message: 'Demo started' });

  // The demo just triggers a coolant fault — the rest flows automatically
  // We simulate a POST to /simulate-fault
  stopSimulation();
  telemetryHistory = [];
  currentFaultType = 'coolant';
  addLog('demo', '🎬 Test Demo started — Coolant System Breakdown scenario');

  incidentManager.createIncident('coolant');

  let tick = 0;
  telemetryInterval = setInterval(async () => {
    tick++;
    const reading = simulator.generateReading('coolant', tick);
    telemetryHistory.push(reading);
    io.emit('telemetry', reading);
    addLog('telemetry', `Sensor reading #${tick}`, reading);

    const anomalies = anomalyDetector.detect(reading);
    if (anomalies.length > 0) {
      io.emit('anomalies', anomalies);
      addLog('anomaly', `Anomalies: ${anomalies.map(a => a.parameter).join(', ')}`);
    }

    if (tick === 3 && incidentManager.getIncident()?.status === 'detected') {
      incidentManager.updateStatus('diagnosing');
      addLog('ai', '🧠 AI analyzing telemetry patterns...');

      try {
        const diagnosis = await gemini.diagnoseFromTelemetry(telemetryHistory);
        incidentManager.setDiagnosis(diagnosis);
        io.emit('diagnosis', diagnosis);
        addLog('ai', '✅ Diagnosis complete', diagnosis);
      } catch (err) {
        const fallback = gemini.getFallbackDiagnosis(telemetryHistory);
        incidentManager.setDiagnosis(fallback);
        io.emit('diagnosis', fallback);
        addLog('ai', 'Using fallback diagnosis', fallback);
      }
    }

    if (tick === 5 && incidentManager.getIncident()?.status === 'diagnosed') {
      await initiateCallFlow();
    }
  }, 2000);
});

function stopSimulation() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
}

function getMechanicsList() {
  return [
    {
      id: 1,
      name: 'AutoCare Express — Downtown',
      rating: 4.8,
      distance: '2.3 km',
      specialty: 'Engine & Transmission',
      phone: '+1 555-0101',
      eta: '12 min',
      address: '142 Main Street, Auburn Hills, MI'
    },
    {
      id: 2,
      name: 'Precision Motors Service',
      rating: 4.6,
      distance: '4.1 km',
      specialty: 'Electrical & Diagnostics',
      phone: '+1 555-0102',
      eta: '18 min',
      address: '89 Industrial Blvd, Pontiac, MI'
    },
    {
      id: 3,
      name: 'Stellantis Certified — Oakland',
      rating: 4.9,
      distance: '5.7 km',
      specialty: 'Stellantis OEM Specialist',
      phone: '+1 555-0103',
      eta: '24 min',
      address: '301 Automotive Dr, Auburn Hills, MI'
    },
    {
      id: 4,
      name: 'QuickFix Auto Center',
      rating: 4.3,
      distance: '7.2 km',
      specialty: 'General Maintenance',
      phone: '+1 555-0104',
      eta: '30 min',
      address: '55 Commerce Rd, Rochester, MI'
    }
  ];
}

// ── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🛡️  STLA Guardian AI — Backend running on port ${PORT}`);
  console.log(`   Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '⚠️  Not configured (using fallback)'}`);
  console.log(`   Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '⚠️  Not configured (simulated calls)'}`);
  console.log('');
});

module.exports = { app, server, io };

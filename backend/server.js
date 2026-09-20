require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const { SimulatorService } = require('./services/simulator');
const { AnomalyDetector } = require('./services/anomalyDetector');
const { IncidentManager } = require('./services/incidentManager');
const { GeminiDiagnosis } = require('./services/geminiDiagnosis');
const { TwilioCallService } = require('./services/twilioCall');
const TrackingService = require('./services/tracking');
const mlClient = require('./services/mlClient');
const RecoveryEngine = require('./services/recoveryEngine');
const { inferTelemetryPrediction } = require('./services/telemetryInference');
const { getVehicleProfile, resetVehicleProfile, startRandomDemoVehicle } = require('./services/vehicleProfile');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  if (req.url.includes('/twilio/')) {
    console.log(`🌐 [TWILIO WEBHOOK] ${req.method} ${req.url}`);
  }
  next();
});

const simulator = new SimulatorService();
const anomalyDetector = new AnomalyDetector();
const incidentManager = new IncidentManager(io);
const gemini = new GeminiDiagnosis();
const trackingService = new TrackingService();
const twilioService = new TwilioCallService(io, incidentManager, trackingService);
const recoveryEngine = new RecoveryEngine(incidentManager, io, twilioService);

// Set Webhook Base URL
if (process.env.RENDER_EXTERNAL_URL) {
  process.env.TWILIO_WEBHOOK_BASE_URL = process.env.RENDER_EXTERNAL_URL;
  twilioService.webhookBaseUrl = process.env.RENDER_EXTERNAL_URL;
  console.log(`✅ Using Render URL for webhooks: ${process.env.RENDER_EXTERNAL_URL}`);
} else {
  // Auto-detect Ngrok URL
  http.get('http://localhost:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const tunnels = JSON.parse(data).tunnels;
        if (tunnels && tunnels.length > 0) {
          const httpsTunnel = tunnels.find(t => t.public_url.startsWith('https'));
          if (httpsTunnel) {
            process.env.TWILIO_WEBHOOK_BASE_URL = httpsTunnel.public_url;
            twilioService.webhookBaseUrl = httpsTunnel.public_url;
            console.log(`✅ Auto-detected Ngrok URL: ${httpsTunnel.public_url}`);
          }
        }
      } catch (e) {
        console.log('⚠️ Could not auto-detect Ngrok URL, using .env value.');
      }
    });
  }).on('error', () => {
    console.log('⚠️ Ngrok API not running on 4040. Make sure ngrok is started.');
  });
}

let telemetryHistory = [];
let telemetryInterval = null;
let currentFaultType = null;
let demoMode = false;
let systemLogs = [];
let tcuPacketCounter = 0;
// A scenario token makes delayed work from an old button press harmless. Without
// this, an older interval/diagnosis could update a newer incident (or leave the
// dashboard looking nominal after a fault was started).
let scenarioSequence = 0;
let activeScenario = null;

// ═══════════════════════════════════════════════════════
// TCU DATA LOG SYSTEM
// ═══════════════════════════════════════════════════════
function generateTcuLog(reading, tick, anomalies = []) {
  tcuPacketCounter++;
  const ecuSources = ['ECU_ENGINE', 'ECU_TRANSMISSION', 'ECU_BATTERY', 'ECU_THERMAL', 'ECU_BODY'];
  const sourceEcu = ecuSources[tcuPacketCounter % ecuSources.length];

  const tcuEntry = {
    packetId: `TCU-${String(tcuPacketCounter).padStart(6, '0')}`,
    timestamp: new Date().toISOString(),
    sourceEcu,
    protocol: 'CAN-FD',
    transmissionStatus: 'SENT',
    sequenceNumber: tick,
    vehicleNumber: getVehicleProfile().registration,
    payload: {
      engineTemp: reading.engineTemp,
      rpm: reading.rpm,
      speed: reading.speed,
      voltage: reading.voltage,
      current: reading.current,
      oilPressure: reading.oilPressure,
      vibration: reading.vibration,
      coolantTemp: reading.coolantTemp,
      coolantPressure: reading.coolantPressure,
      coolantFlowRate: reading.coolantFlowRate,
      batterySoc: reading.batterySoc,
      transmissionTemp: reading.transmissionTemp,
      transmissionPressure: reading.transmissionPressure,
      gearSlip: reading.gearSlip,
      brakeTemp: reading.brakeTemp,
      brakePressure: reading.brakePressure,
      absErrorCount: reading.absErrorCount,
      canErrorCount: reading.canErrorCount,
    },
    abnormalFields: anomalies.map(({ parameter, severity, message }) => ({ parameter, severity, message })),
    metadata: {
      signalStrength: -1 * (40 + Math.floor(Math.random() * 30)) + ' dBm',
      latency: Math.floor(5 + Math.random() * 15) + 'ms',
      networkType: '4G-LTE',
      gatewayId: 'GW-BLR-001',
    }
  };

  // Terminal output
  console.log(`\n📡 ══════════════════════════════════════════════════`);
  console.log(`   TCU PACKET: ${tcuEntry.packetId}`);
  console.log(`   Source: ${sourceEcu} | Protocol: CAN-FD`);
  console.log(`   Time: ${tcuEntry.timestamp}`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`   Engine Temp: ${tcuEntry.payload.engineTemp}°C | RPM: ${tcuEntry.payload.rpm}`);
  console.log(`   Speed: ${tcuEntry.payload.speed} km/h | Voltage: ${tcuEntry.payload.voltage}V`);
  console.log(`   Oil Pressure: ${tcuEntry.payload.oilPressure} PSI | Battery: ${tcuEntry.payload.batterySoc}%`);
  console.log(`   ─────────────────────────────────────────────────`);
  console.log(`   Signal: ${tcuEntry.metadata.signalStrength} | Latency: ${tcuEntry.metadata.latency}`);
  console.log(`   Status: ✅ ${tcuEntry.transmissionStatus}`);
  console.log(`══════════════════════════════════════════════════════`);

  if (tcuEntry.abnormalFields.length) {
    console.log(`   ALERT: ${tcuEntry.abnormalFields.map(({ parameter }) => parameter).join(', ')} outside expected range`);
  }

  // IncidentManager owns the single Socket.IO emission and history update.
  // Emitting here as well created duplicate TCU cards in the frontend.
  incidentManager.addTcuLog(tcuEntry);

  return tcuEntry;
}

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
  console.log(`[${category.toUpperCase()}] ${message}`);
}

// ═══════════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════════
io.on('connection', (socket) => {
  addLog('system', 'Dashboard client connected');
  socket.emit('telemetry-history', telemetryHistory.slice(-30));
  socket.emit('incident', incidentManager.getIncident());
  socket.emit('tcu-history', incidentManager.getIncident()?.tcuLogs || []);
  socket.emit('logs-history', systemLogs.slice(-100));
  socket.emit('vehicle-profile', getVehicleProfile());
  socket.emit('ai-status', gemini.getStatus());
});

app.get('/vehicle-profile', (req, res) => {
  res.json(getVehicleProfile());
});

app.get('/ai/status', (req, res) => {
  res.json(gemini.getStatus());
});

// Safe pre-demo check: exposes only readiness, never phone numbers or keys.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 'demo-flow-2026-09-20',
    ai: gemini.getStatus(),
    calls: twilioService.getConfigurationStatus(),
    activeScenario: activeScenario ? { id: activeScenario.id, type: activeScenario.type } : null,
  });
});

// ═══════════════════════════════════════════════════════
// SIMULATION ENDPOINTS
// ═══════════════════════════════════════════════════════
app.post('/simulate-fault', async (req, res) => {
  const { type } = req.body;
  if (!['engine', 'electrical', 'coolant', 'transmission', 'brake'].includes(type)) {
    return res.status(400).json({ error: 'Invalid fault type. Use: engine, electrical, coolant, transmission, brake' });
  }
  const scenario = startScenario(type, { demo: false });
  res.json({ success: true, faultType: type, runId: scenario.id, message: `Simulation started for ${type} fault` });
});

function startScenario(type, { demo }) {
  stopSimulation();
  twilioService.cancelActiveFlow?.();
  const vehicleProfile = startRandomDemoVehicle();
  io.emit('vehicle-profile', vehicleProfile);
  demoMode = demo;
  currentFaultType = type;
  telemetryHistory = [];
  tcuPacketCounter = 0;

  const incident = incidentManager.createIncident(type);
  const scenario = {
    id: ++scenarioSequence,
    type,
    incidentId: incident.id,
    diagnosisStarted: false,
  };
  activeScenario = scenario;
  addLog(demo ? 'demo' : 'telemetry', `${demo ? 'Demo scenario' : 'Fault simulation'} started: ${type.toUpperCase()} for ${vehicleProfile.brand} ${vehicleProfile.model}`);

  // Start from a clearly abnormal packet. The component highlight is still
  // inferred from these readings, rather than from the selected control.
  publishScenarioReading(scenario, 6);
  let tick = 6;
  telemetryInterval = setInterval(() => {
    tick += 1;
    publishScenarioReading(scenario, tick);
  }, 1000);
  return scenario;
}

function isCurrentScenario(scenario) {
  return activeScenario?.id === scenario.id && incidentManager.getIncident()?.id === scenario.incidentId;
}

function publishScenarioReading(scenario, tick) {
  if (!isCurrentScenario(scenario)) return;
  const reading = simulator.generateReading(scenario.type, tick);
  telemetryHistory.push(reading);
  if (telemetryHistory.length > 100) telemetryHistory.shift();
  io.emit('telemetry', reading);

  const anomalies = anomalyDetector.detect(reading);
  // A judge must see proof of the TCU → backend handoff as soon as a fault is
  // selected. Publish the first abnormal packet immediately, then continue at
  // the promised ten-second cadence.
  const shouldPublishTcuPacket = tick === 6 || (tick - 6) % 10 === 0;
  if (shouldPublishTcuPacket) {
    addLog('telemetry', `Sensor reading #${tick}`, reading);
    generateTcuLog(reading, tick, anomalies);
    const immediatePrediction = inferTelemetryPrediction(telemetryHistory.slice(-10));
    io.emit('health-score', immediatePrediction.healthScore);
  }
  if (anomalies.length > 0) {
    io.emit('anomalies', anomalies);
    if (shouldPublishTcuPacket) addLog('anomaly', `Anomalies detected: ${anomalies.map(a => a.parameter).join(', ')}`, anomalies);
  }

  if (tick >= 10 && anomalies.length > 0 && !scenario.diagnosisStarted && incidentManager.getIncident()?.status === 'detected') {
    scenario.diagnosisStarted = true;
    incidentManager.updateStatus('diagnosing');
    void diagnoseScenario(scenario);
  }
}

async function diagnoseScenario(scenario) {
  const telemetrySnapshot = telemetryHistory.slice();
  try {
    addLog('ai', 'Analyzing live TCU telemetry...');
    const edgePrediction = await mlClient.predict(telemetrySnapshot);
    if (!isCurrentScenario(scenario)) return;
    if (edgePrediction) addLog('ai', 'Edge ML prediction received', edgePrediction);

    // The fault type is not supplied to inference: it is determined from the
    // captured abnormal packet pattern alone.
    const mlPrediction = inferTelemetryPrediction(telemetrySnapshot);
    io.emit('health-score', mlPrediction.healthScore);
    const diagnosis = await gemini.diagnoseFromTelemetry(telemetrySnapshot, null, mlPrediction);
    if (!isCurrentScenario(scenario)) return;
    incidentManager.setDiagnosis(diagnosis);
    addLog('ai', 'Diagnosis complete', diagnosis);
    await recoveryEngine.executeRecovery(diagnosis, telemetrySnapshot, scenario.incidentId);
  } catch (err) {
    if (!isCurrentScenario(scenario)) return;
    addLog('error', `Diagnosis failed: ${err.message}`);
    const fallback = gemini.getFallbackDiagnosis(telemetrySnapshot, null, inferTelemetryPrediction(telemetrySnapshot));
    incidentManager.setDiagnosis(fallback);
    addLog('ai', 'Using local telemetry diagnosis', fallback);
    await recoveryEngine.executeRecovery(fallback, telemetrySnapshot, scenario.incidentId);
  }
}

app.get('/telemetry/stream', (req, res) => {
  res.json({
    current: telemetryHistory[telemetryHistory.length - 1] || null,
    history: telemetryHistory.slice(-30),
    faultType: currentFaultType
  });
});

app.post('/diagnose', async (req, res) => {
  if (telemetryHistory.length === 0) {
    return res.status(400).json({ error: 'No telemetry data available' });
  }
  incidentManager.updateStatus('diagnosing');
  try {
    const diagnosis = await gemini.diagnoseFromTelemetry(telemetryHistory, null, inferTelemetryPrediction(telemetryHistory));
    incidentManager.setDiagnosis(diagnosis);
    io.emit('diagnosis', diagnosis);
    addLog('ai', 'Manual diagnosis complete', diagnosis);
    res.json(diagnosis);
  } catch (err) {
    const fallback = gemini.getFallbackDiagnosis(telemetryHistory, null, inferTelemetryPrediction(telemetryHistory));
    incidentManager.setDiagnosis(fallback);
    io.emit('diagnosis', fallback);
    addLog('ai', 'Using fallback diagnosis', fallback);
    res.json(fallback);
  }
});

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
    await twilioService.initiateEngineerCall(diagnosis, telemetryHistory);
    addLog('call', 'Call connected');
  } catch (err) {
    addLog('call', `Twilio call failed, using simulated call: ${err.message}`);
    await twilioService.simulateCall(diagnosis, telemetryHistory);
  }
}

// ═══════════════════════════════════════════════════════
// TWILIO WEBHOOKS — ENGINEER (Call 1)
// ═══════════════════════════════════════════════════════
app.all('/twilio/voice', (req, res) => {
  console.log('➡️ Twilio hit /twilio/voice webhook!');
  const twiml = twilioService.generateInitialTwiML();
  console.log('⬅️ Sending TwiML response back to Twilio');
  res.type('text/xml');
  res.send(twiml);
});

app.all('/twilio/loop', (req, res) => {
  const twiml = twilioService.generateLoopTwiML();
  res.type('text/xml');
  res.send(twiml);
});

app.all('/twilio/gather', async (req, res) => {
  try {
    const speechResult = req.body?.SpeechResult || req.body?.speechResult || '';
    addLog('call', speechResult ? `Engineer said: ${speechResult}` : 'Engineer speech webhook received without a transcript');
    const twiml = await twilioService.handleEngineerSpeech(speechResult);
    res.type('text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('❌ /twilio/gather CRASH:', err);
    res.status(500).send('Error');
  }
});

app.all('/twilio/status', (req, res) => {
  const status = req.body.CallStatus;
  addLog('call', `Engineer call status: ${status}`);
  twilioService.handleEngineerCallStatus(status);
  res.sendStatus(200);
});

// Alias for the new engineer status endpoint
app.all('/twilio/engineer-status', (req, res) => {
  const status = req.body.CallStatus;
  addLog('call', `Engineer call status: ${status}`);
  twilioService.handleEngineerCallStatus(status);
  res.sendStatus(200);
});

// ═══════════════════════════════════════════════════════
// TWILIO WEBHOOKS — MECHANIC / TOW (Call 2) - TWO-WAY
// ═══════════════════════════════════════════════════════
app.all('/twilio/mechanic-voice', (req, res) => {
  const role = req.query.role || 'service provider';
  const issue = req.query.issue || 'vehicle breakdown';
  const attempt = req.query.attempt || '1';
  console.log(`➡️ Twilio hit /twilio/mechanic-voice (${role}, attempt ${attempt})`);
  const twiml = twilioService.generateMechanicVoiceTwiML(role, issue, attempt);
  res.type('text/xml');
  res.send(twiml);
});

app.all('/twilio/mechanic-gather', async (req, res) => {
  try {
    const speechResult = req.body?.SpeechResult || req.body?.speechResult || '';
    const role = req.query.role || 'service provider';
    const issue = req.query.issue || 'vehicle breakdown';
    const attempt = req.query.attempt || '1';
    addLog('call', speechResult ? `${role} said: ${speechResult}` : `${role} speech webhook received without a transcript`);
    const twiml = await twilioService.handleMechanicSpeech(speechResult, role, issue, parseInt(attempt));
    res.type('text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('❌ /twilio/mechanic-gather CRASH:', err);
    res.status(500).send('Error');
  }
});

app.all('/twilio/mechanic-status', (req, res) => {
  const status = req.body.CallStatus;
  addLog('call', `Mechanic/tow call status: ${status}`);
  twilioService.handleMechanicCallStatus(status, req.query.attempt, req.body.CallSid);
  res.sendStatus(200);
});

// ═══════════════════════════════════════════════════════
// TWILIO WEBHOOKS — DRIVER (Call 3)
// ═══════════════════════════════════════════════════════
app.all('/twilio/driver-voice', (req, res) => {
  const role = req.query.role || 'service provider';
  const issue = req.query.issue || 'system failure';
  const eta = req.query.eta || '15 min';
  console.log(`➡️ Twilio hit /twilio/driver-voice (${role})`);
  const twiml = twilioService.generateDriverVoiceTwiML(role, issue, eta);
  res.type('text/xml');
  res.send(twiml);
});

app.all('/twilio/driver-status', (req, res) => {
  const status = req.body.CallStatus;
  addLog('call', `Driver call status: ${status}`);
  twilioService.handleDriverCallStatus(status);
  res.sendStatus(200);
});

// Legacy dispatch endpoints (keep for backward compat)
app.all('/twilio/dispatch-status', (req, res) => {
  const status = req.body.CallStatus;
  addLog('call', `Service provider call status: ${status}`);
  twilioService.handleMechanicCallStatus(status);
  res.sendStatus(200);
});

app.all('/twilio/dispatch-voice', (req, res) => {
  const role = req.query.role || 'service provider';
  const issue = req.query.issue || 'system failure';
  const twiml = twilioService.generateMechanicVoiceTwiML(role, issue, '1');
  res.type('text/xml');
  res.send(twiml);
});

// ═══════════════════════════════════════════════════════
// TRACKING ENDPOINTS
// ═══════════════════════════════════════════════════════
app.get('/track/:sessionId', (req, res) => {
  const trackingPage = path.join(__dirname, 'public', 'tracking.html');
  if (fs.existsSync(trackingPage)) {
    res.sendFile(trackingPage);
  } else {
    res.status(404).send('Tracking page not found');
  }
});

app.get('/api/tracking/:sessionId', (req, res) => {
  const session = trackingService.getSession(req.params.sessionId, req.query.t);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.get('/api/tracking/:sessionId/position', (req, res) => {
  const position = trackingService.getPosition(req.params.sessionId, req.query.t);
  if (!position) return res.status(404).json({ error: 'Session not found' });
  res.json(position);
});

app.post('/api/tracking/:sessionId/complete', (req, res) => {
  trackingService.markCompleted(req.params.sessionId);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════
// RESOLVE / INCIDENT ENDPOINTS
// ═══════════════════════════════════════════════════════
app.post('/resolve', async (req, res) => {
  const { action } = req.body;
  const incident = incidentManager.getIncident();
  if (!incident) return res.status(400).json({ error: 'No active incident found. Please trigger a new simulation.' });
  if (action === 'auto-fix') {
    if (incident?.status === 'resolving' || incident?.status === 'resolved') return res.json({ success: true });
    incidentManager.updateStatus('resolving');
    addLog('resolution', 'Auto-fix initiated, normalizing telemetry...');
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
    if (incident?.status === 'escalated') return res.json({ success: true });
    incidentManager.updateStatus('escalated');
    const mechanics = getMechanicsList();
    incidentManager.setMechanics(mechanics);
    io.emit('mechanics', mechanics);
    addLog('resolution', 'Escalated to field mechanic', mechanics);
    stopSimulation();
    res.json({ success: true, action: 'escalate', mechanics });
  } else if (action === 'dispatch-tow') {
    if (incident?.status === 'escalated') return res.json({ success: true });
    incidentManager.updateStatus('escalated');
    const towCompany = {
      id: 99,
      name: 'RapidRescue Towing Services',
      rating: 4.8,
      distance: '3.1 km',
      specialty: 'Heavy Duty & Flatbed Towing',
      phone: '+1 555-0199',
      eta: '15 min',
      address: '200 Industrial Dr, Auburn Hills, MI'
    };
    incidentManager.setMechanics([towCompany]);
    io.emit('mechanics', [towCompany]);
    addLog('resolution', 'Contacting nearest Tow Company...', towCompany);
    stopSimulation();
    res.json({ success: true, action: 'dispatch-tow', company: towCompany });
  } else {
    res.status(400).json({ error: 'Invalid action. Use: auto-fix, escalate, or dispatch-tow' });
  }
});

app.get('/incident', (req, res) => {
  res.json(incidentManager.getIncident());
});

app.post('/reset', (req, res) => {
  stopSimulation();
  twilioService.cancelActiveFlow?.();
  incidentManager.reset();
  demoMode = false;
  currentFaultType = null;
  systemLogs = [];
  telemetryHistory = [];
  tcuPacketCounter = 0;
  resetVehicleProfile();
  io.emit('vehicle-profile', getVehicleProfile());
  io.emit('logs-history', []);
  io.emit('telemetry', null);
  io.emit('log', { timestamp: new Date().toISOString(), category: 'system', message: 'System reset' });
  io.emit('incident', null);
  res.json({ success: true });
});

app.post('/test-demo', async (req, res) => {
  const faults = ['engine', 'electrical', 'coolant', 'transmission', 'brake'];
  const type = faults[Math.floor(Math.random() * faults.length)];
  const scenario = startScenario(type, { demo: true });
  res.json({
    success: true,
    fault: type,
    runId: scenario.id,
    message: 'Randomized live telemetry scenario started',
  });
});

function stopSimulation() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
  activeScenario = null;
  recoveryEngine.cancelPending?.();
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

// ═══════════════════════════════════════════════════════
// PRODUCTION: Serve frontend build
// ═══════════════════════════════════════════════════════
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  // Catch-all: serve index.html for any non-API route (SPA routing)
  app.get('*', (req, res) => {
    // Don't catch API routes, twilio webhooks, or tracking pages
    if (req.url.startsWith('/api/') || req.url.startsWith('/twilio/') || req.url.startsWith('/track/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
  console.log('🌐 Serving frontend build from ../frontend/dist');
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`📡 TCU Data Logs will appear here in the terminal`);
  console.log(`🗺️  Tracking pages served at /track/:sessionId`);
  if (process.env.RENDER) {
    console.log(`🚀 Running on Render — no ngrok needed`);
  }
});
module.exports = { app, server, io };

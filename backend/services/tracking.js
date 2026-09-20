const { v4: uuidv4 } = require('uuid');

class TrackingService {
  constructor() {
    this.sessions = new Map();
  }

  createSession(incident, role, eta) {
    const sessionId = uuidv4().split('-')[0];
    // Driver location (Bangalore area)
    const driverLat = 12.9716;
    const driverLon = 77.5946;
    // Service provider starts ~3-5km away
    const startLat = driverLat + (0.02 + Math.random() * 0.015);
    const startLon = driverLon + (0.02 + Math.random() * 0.015);

    const etaMinutes = parseInt(eta) || 12;
    const createdAt = Date.now();
    const simulationDurationSeconds = Math.max(30, Number(process.env.TRACKING_DEMO_DURATION_SECONDS || 90));
    const session = {
      sessionId,
      role,
      status: 'en-route',
      driverLocation: { lat: driverLat, lon: driverLon },
      providerStart: { lat: startLat, lon: startLon },
      providerCurrent: { lat: startLat, lon: startLon },
      vehicleNumber: this._generateVehicleNumber(),
      providerPhone: process.env.TWILIO_MECHANIC_NUMBER || process.env.DEMO_CONTACT_NUMBER || '+919535728467',
      providerName: role === 'tow truck' ? 'RapidRescue Towing' : 'AutoCare Express',
      etaMinutes,
      simulationDurationSeconds,
      etaRemainingSeconds: etaMinutes * 60,
      createdAt,
      arrivalTime: createdAt + (simulationDurationSeconds * 1000),
      rootCause: incident?.diagnosis?.rootCause || 'Vehicle breakdown',
    };

    session.trackingToken = this._createPublicToken(session);

    this.sessions.set(sessionId, session);

    // Start simulating movement
    this._simulateMovement(sessionId);

    return session;
  }

  getSession(sessionId, trackingToken) {
    return this.sessions.get(sessionId) || this._restorePublicSession(sessionId, trackingToken);
  }

  getPosition(sessionId, trackingToken) {
    const session = this.getSession(sessionId, trackingToken);
    if (!session) return null;

    const elapsed = Date.now() - session.createdAt;
    const totalDuration = session.simulationDurationSeconds * 1000;
    const progress = Math.min(elapsed / totalDuration, 1.0);

    // Interpolate position
    const lat = session.providerStart.lat + (session.driverLocation.lat - session.providerStart.lat) * progress;
    const lon = session.providerStart.lon + (session.driverLocation.lon - session.providerStart.lon) * progress;

    const remainingSeconds = Math.ceil(session.etaMinutes * 60 * (1 - progress));

    // Check arrival
    if (progress >= 1.0 && session.status === 'en-route') {
      session.status = 'arrived';
    }

    return {
      sessionId: session.sessionId,
      status: session.status,
      role: session.role,
      providerName: session.providerName,
      providerPhone: session.providerPhone,
      vehicleNumber: session.vehicleNumber,
      rootCause: session.rootCause,
      driverLocation: session.driverLocation,
      providerLocation: { lat, lon },
      progress: Math.round(progress * 100),
      etaRemainingSeconds: remainingSeconds,
      etaRemainingFormatted: this._formatTime(remainingSeconds),
    };
  }

  _simulateMovement(sessionId) {
    const interval = setInterval(() => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        clearInterval(interval);
        return;
      }
      if (session.status === 'arrived' || session.status === 'completed') {
        clearInterval(interval);
        return;
      }
      // Update current position
      const pos = this.getPosition(sessionId);
      if (pos) {
        session.providerCurrent = pos.providerLocation;
      }
    }, 2000);
  }

  markCompleted(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
    }
  }

  getPublicTrackingUrl(session, baseUrl) {
    const base = String(baseUrl || '').replace(/\/$/, '');
    return `${base}/track/${session.sessionId}?t=${encodeURIComponent(session.trackingToken)}`;
  }

  _createPublicToken(session) {
    const payload = {
      v: 1,
      sessionId: session.sessionId,
      role: session.role,
      driverLocation: session.driverLocation,
      providerStart: session.providerStart,
      vehicleNumber: session.vehicleNumber,
      providerPhone: session.providerPhone,
      providerName: session.providerName,
      etaMinutes: session.etaMinutes,
      simulationDurationSeconds: session.simulationDurationSeconds,
      createdAt: session.createdAt,
      rootCause: session.rootCause,
      expiresAt: session.createdAt + (24 * 60 * 60 * 1000),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  _restorePublicSession(sessionId, trackingToken) {
    if (!trackingToken) return null;
    try {
      const payload = JSON.parse(Buffer.from(String(trackingToken), 'base64url').toString('utf8'));
      const required = ['sessionId', 'role', 'driverLocation', 'providerStart', 'vehicleNumber', 'providerPhone', 'providerName', 'etaMinutes', 'simulationDurationSeconds', 'createdAt', 'rootCause', 'expiresAt'];
      if (payload.v !== 1 || payload.sessionId !== sessionId || required.some((key) => payload[key] == null) || Date.now() > payload.expiresAt) return null;

      const session = {
        sessionId: payload.sessionId,
        role: payload.role,
        status: 'en-route',
        driverLocation: payload.driverLocation,
        providerStart: payload.providerStart,
        providerCurrent: payload.providerStart,
        vehicleNumber: payload.vehicleNumber,
        providerPhone: payload.providerPhone,
        providerName: payload.providerName,
        etaMinutes: Number(payload.etaMinutes),
        simulationDurationSeconds: Number(payload.simulationDurationSeconds),
        etaRemainingSeconds: Number(payload.etaMinutes) * 60,
        createdAt: Number(payload.createdAt),
        arrivalTime: Number(payload.createdAt) + (Number(payload.simulationDurationSeconds) * 1000),
        rootCause: payload.rootCause,
        trackingToken: trackingToken,
      };
      this.sessions.set(sessionId, session);
      this._simulateMovement(sessionId);
      return session;
    } catch {
      return null;
    }
  }

  _generateVehicleNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const num = Math.floor(1000 + Math.random() * 9000);
    const alpha = chars[Math.floor(Math.random() * 26)] + chars[Math.floor(Math.random() * 26)];
    return `KA-01-${alpha}-${num}`;
  }

  _formatTime(totalSeconds) {
    if (totalSeconds <= 0) return 'Arrived';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `${mins} min ${secs}s`;
    return `${secs}s`;
  }
}

module.exports = TrackingService;

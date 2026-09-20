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
    const session = {
      sessionId,
      role,
      status: 'en-route',
      driverLocation: { lat: driverLat, lon: driverLon },
      providerStart: { lat: startLat, lon: startLon },
      providerCurrent: { lat: startLat, lon: startLon },
      vehicleNumber: this._generateVehicleNumber(),
      providerPhone: '+919535728467',
      providerName: role === 'tow truck' ? 'RapidRescue Towing' : 'AutoCare Express',
      etaMinutes,
      etaRemainingSeconds: etaMinutes * 60,
      createdAt: Date.now(),
      arrivalTime: Date.now() + (etaMinutes * 60 * 1000),
      rootCause: incident?.diagnosis?.rootCause || 'Vehicle breakdown',
    };

    this.sessions.set(sessionId, session);

    // Start simulating movement
    this._simulateMovement(sessionId);

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getPosition(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const elapsed = Date.now() - session.createdAt;
    const totalDuration = session.etaMinutes * 60 * 1000;
    const progress = Math.min(elapsed / totalDuration, 1.0);

    // Interpolate position
    const lat = session.providerStart.lat + (session.driverLocation.lat - session.providerStart.lat) * progress;
    const lon = session.providerStart.lon + (session.driverLocation.lon - session.providerStart.lon) * progress;

    const remainingMs = Math.max(0, session.arrivalTime - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);

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

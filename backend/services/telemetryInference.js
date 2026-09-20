const profiles = {
  engine: {
    label: 'Engine mechanical fault',
    affectedSystem: 'Engine / Powertrain',
    affectedParameters: ['RPM', 'Oil pressure', 'Vibration'],
    score(reading) {
      return Math.max(
        ratio(reading.rpm, 1200, 4600),
        inverseRatio(reading.oilPressure, 32, 12),
        ratio(reading.vibration, 1.2, 3.5)
      );
    },
  },
  electrical: {
    label: 'Electrical circuit fault',
    affectedSystem: 'Electrical System',
    affectedParameters: ['Voltage', 'Current draw', 'Battery state of charge'],
    score(reading) {
      return Math.max(
        inverseRatio(reading.voltage, 12.4, 10.2),
        ratio(reading.current, 38, 68),
        inverseRatio(reading.batterySoc, 78, 35)
      );
    },
  },
  coolant: {
    label: 'Cooling system fault',
    affectedSystem: 'Cooling System',
    affectedParameters: ['Coolant temperature', 'Coolant pressure', 'Coolant flow'],
    score(reading) {
      return Math.max(
        ratio(reading.coolantTemp, 98, 118),
        inverseRatio(reading.coolantPressure, 11, 4),
        inverseRatio(reading.coolantFlowRate, 5.5, 1.8)
      );
    },
  },
  transmission: {
    label: 'Transmission fault',
    affectedSystem: 'Transmission',
    affectedParameters: ['Transmission temperature', 'Gear slip', 'Transmission pressure'],
    score(reading) {
      return Math.max(
        ratio(reading.transmissionTemp, 100, 132),
        ratio(reading.gearSlip, 6, 22),
        inverseRatio(reading.transmissionPressure, 58, 30)
      );
    },
  },
  brake: {
    label: 'Brake system fault',
    affectedSystem: 'Braking System',
    affectedParameters: ['Brake temperature', 'Brake pressure', 'ABS fault count'],
    score(reading) {
      return Math.max(
        ratio(reading.brakeTemp, 240, 430),
        inverseRatio(reading.brakePressure, 75, 38),
        ratio(reading.absErrorCount, 1, 8)
      );
    },
  },
};

function ratio(value, normalLimit, criticalLimit) {
  if (typeof value !== 'number') return 0;
  return clamp((value - normalLimit) / (criticalLimit - normalLimit));
}

function inverseRatio(value, normalLimit, criticalLimit) {
  if (typeof value !== 'number') return 0;
  return clamp((normalLimit - value) / (normalLimit - criticalLimit));
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Classifies the latest telemetry pattern without receiving the simulation button
 * or incident trigger. This is the local equivalent of the edge classifier when
 * the Python ML service is unavailable.
 */
function inferTelemetryPrediction(history = []) {
  const reading = history[history.length - 1];
  if (!reading) {
    return {
      fault: 'general',
      confidence: 0,
      probability: 0,
      severity: 1,
      healthScore: 100,
      affectedSystem: 'Unknown',
      affectedParameters: [],
      inference: 'Waiting for telemetry',
    };
  }

  const ranked = Object.entries(profiles)
    .map(([fault, profile]) => ({ fault, profile, score: profile.score(reading) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const confidence = Math.round(55 + best.score * 40);
  const severity = best.score >= 0.8 ? 5 : best.score >= 0.5 ? 4 : best.score >= 0.2 ? 3 : 1;

  return {
    fault: best.score >= 0.15 ? best.fault : 'general',
    probability: Number(best.score.toFixed(2)),
    confidence: best.score >= 0.15 ? confidence : 45,
    severity,
    healthScore: Math.max(5, Math.round(100 - best.score * 75)),
    affectedSystem: best.score >= 0.15 ? best.profile.affectedSystem : 'General vehicle health',
    affectedParameters: best.score >= 0.15 ? best.profile.affectedParameters : [],
    inference: 'Derived from live TCU telemetry only',
    patternScore: Number(best.score.toFixed(2)),
  };
}

module.exports = { inferTelemetryPrediction };

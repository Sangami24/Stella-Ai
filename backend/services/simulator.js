/**
 * Telemetry Simulator — generates realistic sensor data for 3 fault types.
 * Each fault produces a distinct telemetry signature that Gemini must diagnose
 * without being told the fault type.
 */
class SimulatorService {
  constructor() {
    this.baselineValues = {
      rpm: 800,
      oilPressure: 40,        // psi
      engineTemp: 90,          // °C (engine temp, not coolant)
      voltage: 14.2,           // V
      current: 25,             // A
      batterySoc: 95,          // %
      coolantTemp: 88,         // °C
      coolantPressure: 15,     // psi
      coolantFlowRate: 8.5,    // L/min
      speed: 60,               // km/h
      vibration: 0.3,          // g
      throttle: 30,            // %
      tirePressure: 32,        // psi
      brakeTemp: 150,          // °C
      fuelPressure: 45,        // psi
      canErrorCount: 0,        // count
      gpsCoordinates: '12.9716, 77.5946'
    };
  }

  /**
   * Generate a telemetry reading based on fault type and tick number.
   * The tick number controls progression severity.
   */
  generateReading(faultType, tick) {
    const noise = () => (Math.random() - 0.5) * 2; // ±1
    const base = { ...this.baselineValues };
    const timestamp = new Date().toISOString();

    switch (faultType) {
      case 'engine':
        return this._engineFault(base, tick, noise, timestamp);
      case 'electrical':
        return this._electricalFault(base, tick, noise, timestamp);
      case 'coolant':
        return this._coolantFault(base, tick, noise, timestamp);
      default:
        return { ...base, timestamp };
    }
  }

  /**
   * Engine Fault Profile:
   * - RPM becomes erratic (spikes to 3000-6000, oscillates)
   * - Oil pressure drops progressively
   * - Vibration increases sharply
   * - Engine temp climbs moderately
   */
  _engineFault(base, tick, noise, timestamp) {
    const severity = Math.min(tick / 8, 1); // 0→1 over 8 ticks

    return {
      ...base,
      timestamp,
      rpm: Math.round(base.rpm + severity * (2000 + Math.sin(tick * 1.5) * 2500) + noise() * 200),
      oilPressure: Math.round((base.oilPressure - severity * 28 + noise() * 2) * 10) / 10,
      engineTemp: Math.round((base.engineTemp + severity * 25 + noise() * 2) * 10) / 10,
      vibration: Math.round((base.vibration + severity * 2.8 + noise() * 0.3) * 10) / 10,
      canErrorCount: Math.round(severity * 15)
    };
  }

  /**
   * Electrical Fault Profile:
   * - Voltage drops below 11V
   * - Current spikes erratically
   * - Battery SOC drains rapidly
   */
  _electricalFault(base, tick, noise, timestamp) {
    const severity = Math.min(tick / 8, 1);

    return {
      ...base,
      timestamp,
      voltage: Math.round((base.voltage - severity * 3.5 + noise() * 0.5) * 10) / 10,
      current: Math.round(base.current + severity * (30 + Math.abs(noise()) * 20)),
      batterySoc: Math.round(base.batterySoc - severity * (15 + tick * 1.5)),
      canErrorCount: Math.round(severity * 25)
    };
  }

  /**
   * Coolant Fault Profile:
   * - Coolant temp spikes rapidly
   * - Coolant pressure drops
   * - Flow rate drops
   * - Engine temp follows with a delay
   */
  _coolantFault(base, tick, noise, timestamp) {
    const severity = Math.min(tick / 8, 1);
    
    return {
      ...base,
      timestamp,
      coolantTemp: Math.round((base.coolantTemp + severity * 30 + noise() * 1.5) * 10) / 10,
      coolantPressure: Math.round((base.coolantPressure - severity * 10 + noise()) * 10) / 10,
      coolantFlowRate: Math.round((base.coolantFlowRate - severity * 6 + noise() * 0.5) * 10) / 10,
      engineTemp: Math.round((base.engineTemp + severity * 15 + noise()) * 10) / 10,
      canErrorCount: Math.round(severity * 5)
    };
  }

  /**
   * Generate normal/recovery readings (all values return to baseline)
   */
  generateNormalReading(recoveryTick) {
    const noise = () => (Math.random() - 0.5) * 1;
    const base = { ...this.baselineValues };
    const recovery = Math.min(recoveryTick / 4, 1);

    return {
      timestamp: new Date().toISOString(),
      rpm: Math.round(base.rpm + noise() * 30),
      oilPressure: Math.round((base.oilPressure + noise()) * 10) / 10,
      engineTemp: Math.round((base.engineTemp + (1 - recovery) * 10 + noise()) * 10) / 10,
      voltage: Math.round((base.voltage + noise() * 0.2) * 10) / 10,
      current: Math.round((base.current + noise() * 2) * 10) / 10,
      batterySoc: Math.round((base.batterySoc + noise()) * 10) / 10,
      coolantTemp: Math.round((base.coolantTemp + (1 - recovery) * 8 + noise()) * 10) / 10,
      coolantPressure: Math.round((base.coolantPressure + noise() * 0.3) * 10) / 10,
      coolantFlowRate: Math.round((base.coolantFlowRate + noise() * 0.2) * 10) / 10,
      speed: Math.round(base.speed + noise() * 3),
      vibration: Math.round((base.vibration + noise() * 0.1) * 100) / 100,
      throttle: Math.round(base.throttle + noise() * 3),
    };
  }
}

module.exports = { SimulatorService };

class AnomalyDetector {
  constructor() {
    this.thresholds = {
      rpm:              [600, 1200, 400, 5000],
      oilPressure:      [25, 60, 15, 80],
      engineTemp:       [70, 105, 50, 120],
      voltage:          [12.0, 15.0, 10.5, 16.0],
      current:          [10, 40, 5, 70],
      batterySoc:       [50, 100, 30, 100],
      coolantTemp:      [70, 100, 50, 115],
      coolantPressure:  [10, 20, 5, 25],
      coolantFlowRate:  [5, 12, 3, 15],
      vibration:        [0, 1.5, 0, 3.0],
    };
    this.units = {
      rpm: 'RPM',
      oilPressure: 'psi',
      engineTemp: '°C',
      voltage: 'V',
      current: 'A',
      batterySoc: '%',
      coolantTemp: '°C',
      coolantPressure: 'psi',
      coolantFlowRate: 'L/min',
      vibration: 'g',
    };
  }
  detect(reading) {
    const anomalies = [];
    for (const [param, [wLow, wHigh, cLow, cHigh]] of Object.entries(this.thresholds)) {
      const value = reading[param];
      if (value === undefined) continue;
      let severity = null;
      let message = '';
      if (value <= cLow) {
        severity = 'critical';
        message = `${param} critically low: ${value} ${this.units[param]} (threshold: ${cLow})`;
      } else if (value >= cHigh) {
        severity = 'critical';
        message = `${param} critically high: ${value} ${this.units[param]} (threshold: ${cHigh})`;
      } else if (value <= wLow) {
        severity = 'warning';
        message = `${param} below normal: ${value} ${this.units[param]} (threshold: ${wLow})`;
      } else if (value >= wHigh) {
        severity = 'warning';
        message = `${param} above normal: ${value} ${this.units[param]} (threshold: ${wHigh})`;
      }
      if (severity) {
        anomalies.push({
          parameter: param,
          value,
          unit: this.units[param],
          severity,
          message,
          timestamp: reading.timestamp
        });
      }
    }
    return anomalies;
  }
}
module.exports = { AnomalyDetector };

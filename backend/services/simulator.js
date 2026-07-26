class SimulatorService {
  constructor() {
    this.baselineValues = {
      rpm: 800,
      oilPressure: 40,        
      engineTemp: 90,          
      voltage: 14.2,           
      current: 25,             
      batterySoc: 95,          
      coolantTemp: 88,         
      coolantPressure: 15,     
      coolantFlowRate: 8.5,    
      speed: 60,               
      vibration: 0.3,          
      throttle: 30,            
      tirePressure: 32,        
      brakeTemp: 150,          
      fuelPressure: 45,        
      canErrorCount: 0,        
      gpsCoordinates: '12.9716, 77.5946'
    };
  }
  generateReading(faultType, tick) {
    const noise = () => (Math.random() - 0.5) * 2; 
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
  _engineFault(base, tick, noise, timestamp) {
    const severity = Math.min(tick / 8, 1); 
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

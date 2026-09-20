function configuredValue(name, fallback) {
  const value = String(process.env[name] || '').trim();
  return value || fallback;
}

// These are internally consistent demo profiles. They are deliberately kept
// separate from a real vehicle integration: a real car must provide its VIN
// and specification from an approved vehicle-data source.
const DEMO_VEHICLES = [
  { brand: 'Jeep', model: 'Compass Limited', trim: '2.0L diesel automatic demo configuration', modelYear: '2024', curbWeightKg: '1,736', lengthMm: '4,404', widthMm: '1,818', heightMm: '1,640' },
  { brand: 'Citroen', model: 'C5 Aircross Shine', trim: '2.0L diesel automatic demo configuration', modelYear: '2024', curbWeightKg: '1,685', lengthMm: '4,500', widthMm: '1,969', heightMm: '1,710' },
  { brand: 'Peugeot', model: '3008 GT', trim: 'hybrid automatic demo configuration', modelYear: '2025', curbWeightKg: '1,552', lengthMm: '4,542', widthMm: '1,895', heightMm: '1,641' },
  { brand: 'Opel', model: 'Grandland GS', trim: 'hybrid automatic demo configuration', modelYear: '2025', curbWeightKg: '1,580', lengthMm: '4,650', widthMm: '1,905', heightMm: '1,660' },
];

let activeDemoProfile = null;
let lastDemoIndex = -1;

function configuredProfile() {
  return {
    brand: configuredValue('VEHICLE_BRAND', 'Stellantis'),
    model: configuredValue('VEHICLE_MODEL', 'STLA Medium demo vehicle'),
    trim: configuredValue('VEHICLE_TRIM', '2.0L turbo demo configuration'),
    modelYear: configuredValue('VEHICLE_YEAR', '2026'),
    vin: configuredValue('VEHICLE_VIN', 'STELLA2400AI'),
    registration: configuredValue('VEHICLE_REGISTRATION', 'KA-01-AB-1234'),
    curbWeightKg: configuredValue('VEHICLE_CURB_WEIGHT_KG', 'Not configured'),
    lengthMm: configuredValue('VEHICLE_LENGTH_MM', 'Not configured'),
    widthMm: configuredValue('VEHICLE_WIDTH_MM', 'Not configured'),
    heightMm: configuredValue('VEHICLE_HEIGHT_MM', 'Not configured'),
  };
}

function startRandomDemoVehicle() {
  if (process.env.RANDOM_DEMO_VEHICLE === 'false') {
    activeDemoProfile = null;
    return configuredProfile();
  }

  let index = Math.floor(Math.random() * DEMO_VEHICLES.length);
  if (DEMO_VEHICLES.length > 1 && index === lastDemoIndex) index = (index + 1) % DEMO_VEHICLES.length;
  lastDemoIndex = index;
  const serial = Math.floor(1000 + Math.random() * 9000);
  const vehicle = DEMO_VEHICLES[index];
  activeDemoProfile = {
    ...vehicle,
    vin: `DEMO${vehicle.brand.slice(0, 3).toUpperCase()}${vehicle.modelYear}${serial}`,
    registration: `KA-01-SA-${serial}`,
  };
  return activeDemoProfile;
}

function resetVehicleProfile() {
  activeDemoProfile = null;
}

function getVehicleProfile() {
  return activeDemoProfile || configuredProfile();
}

module.exports = { getVehicleProfile, resetVehicleProfile, startRandomDemoVehicle };

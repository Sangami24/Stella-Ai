const WEATHER_CODES = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'foggy', 48: 'foggy with frost', 51: 'light drizzle', 53: 'drizzle',
  55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers',
  81: 'moderate rain showers', 82: 'heavy rain showers', 95: 'thunderstorm',
  96: 'thunderstorm with hail', 99: 'severe thunderstorm with hail',
};

function extractWeatherLocation(question) {
  const text = String(question || '').toLowerCase();
  if (text.includes('bangalore') || text.includes('bengaluru')) return 'Bengaluru, Karnataka, India';
  const match = text.match(/(?:weather|temperature|rain|forecast)\s+(?:in|at|for)\s+([a-zA-Z\s,-]{2,60})/i);
  return match?.[1]?.trim() || null;
}

function isWeatherQuestion(question) {
  const text = String(question || '');
  if (/\b(weather|forecast|rain|raining|humidity|wind)\b/i.test(text)) return true;
  return /\btemperature\b.*\b(in|at|for)\b/i.test(text)
    || /\b(bangalore|bengaluru)\b.*\btemperature\b/i.test(text);
}

async function getCurrentWeather(location) {
  const search = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
  if (!search.ok) throw new Error(`Weather geocoding failed (${search.status})`);
  const place = (await search.json()).results?.[0];
  if (!place) throw new Error('Location not found');

  const currentFields = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation';
  const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=${currentFields}&timezone=auto`);
  if (!forecast.ok) throw new Error(`Weather lookup failed (${forecast.status})`);
  const { current, current_units: units } = await forecast.json();
  if (!current) throw new Error('Current weather is unavailable');

  return {
    location: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    precipitation: current.precipitation,
    condition: WEATHER_CODES[current.weather_code] || 'unknown conditions',
    units: units || { temperature_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' },
  };
}

function formatWeatherReply(weather) {
  const temperatureUnit = weather.units.temperature_2m || '°C';
  const windUnit = weather.units.wind_speed_10m || 'km/h';
  const precipitationUnit = weather.units.precipitation || 'mm';
  return `In ${weather.location}, it is ${weather.temperature}${temperatureUnit} and ${weather.condition}; humidity is ${weather.humidity} percent, wind ${weather.windSpeed} ${windUnit}, and precipitation ${weather.precipitation} ${precipitationUnit}.`;
}

module.exports = { extractWeatherLocation, formatWeatherReply, getCurrentWeather, isWeatherQuestion };

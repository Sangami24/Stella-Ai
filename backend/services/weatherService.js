const WEATHER_CODES = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'foggy', 48: 'foggy with frost', 51: 'light drizzle', 53: 'drizzle',
  55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers',
  81: 'moderate rain showers', 82: 'heavy rain showers', 95: 'thunderstorm',
  96: 'thunderstorm with hail', 99: 'severe thunderstorm with hail',
};

const KNOWN_LOCATIONS = {
  bengaluru: {
    aliases: ['bangalore', 'bengaluru'],
    name: 'Bengaluru, Karnataka, India',
    latitude: 12.9716,
    longitude: 77.5946,
  },
};

function fetchJson(url, label) {
  return fetch(url, {
    headers: { 'User-Agent': 'Stella-AI-Demo/1.0' },
    signal: AbortSignal.timeout(8000),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`${label} failed (${response.status})`);
    return response.json();
  });
}

function findKnownLocation(location) {
  const value = String(location || '').toLowerCase();
  return Object.values(KNOWN_LOCATIONS).find((place) => place.aliases.some((alias) => value.includes(alias))) || null;
}

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
  const knownLocation = findKnownLocation(location);
  let place = knownLocation;

  if (!place) {
    const searchData = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
      'Weather geocoding',
    );
    const result = searchData.results?.[0];
    if (!result) throw new Error('Location not found');
    place = {
      name: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  const currentFields = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation';
  try {
    const forecastData = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=${currentFields}&timezone=auto`,
      'Weather lookup',
    );
    const { current, current_units: units } = forecastData;
    if (!current) throw new Error('Current weather is unavailable');
    return {
      location: place.name,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      precipitation: current.precipitation,
      condition: WEATHER_CODES[current.weather_code] || 'unknown conditions',
      units: units || { temperature_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' },
    };
  } catch (openMeteoError) {
    const wttrLocation = encodeURIComponent(knownLocation ? 'Bengaluru' : location);
    const wttrData = await fetchJson(`https://wttr.in/${wttrLocation}?format=j1`, 'Weather fallback');
    const current = wttrData.current_condition?.[0];
    if (!current) throw openMeteoError;
    return {
      location: place.name,
      temperature: Number(current.temp_C),
      apparentTemperature: Number(current.FeelsLikeC),
      humidity: Number(current.humidity),
      windSpeed: Number(current.windspeedKmph),
      precipitation: Number(current.precipMM),
      condition: current.weatherDesc?.[0]?.value || 'unknown conditions',
      units: { temperature_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' },
    };
  }
}

function formatWeatherReply(weather) {
  const temperatureUnit = weather.units.temperature_2m || '°C';
  const windUnit = weather.units.wind_speed_10m || 'km/h';
  const precipitationUnit = weather.units.precipitation || 'mm';
  return `In ${weather.location}, it is ${weather.temperature}${temperatureUnit} and ${weather.condition}; humidity is ${weather.humidity} percent, wind ${weather.windSpeed} ${windUnit}, and precipitation ${weather.precipitation} ${precipitationUnit}.`;
}

module.exports = { extractWeatherLocation, formatWeatherReply, getCurrentWeather, isWeatherQuestion };

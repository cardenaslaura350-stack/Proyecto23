// Pega aquí tu API Key gratuita de WeatherAPI.com
const API_KEY = "f103588637274f2185714745262111";
const BASE_URL = "https://api.weatherapi.com/v1";

// Ubicación por defecto
let currentLocationQuery = "Sogamoso";

// Elementos del DOM
const searchForm = document.getElementById("search-form");
const locationInput = document.getElementById("location-input");
const refreshBtn = document.getElementById("refresh-btn");
const geoBtn = document.getElementById("geo-btn");
const statusMessage = document.getElementById("status-message");
const weatherContent = document.getElementById("weather-content");

const locationNameEl = document.getElementById("location-name");
const currentDateEl = document.getElementById("current-date");
const weatherConditionEl = document.getElementById("weather-condition");
const currentTempEl = document.getElementById("current-temp");
const currentWindEl = document.getElementById("current-wind");
const currentRainEl = document.getElementById("current-rain");
const futureHoursEl = document.getElementById("future-hours");
const pastHoursEl = document.getElementById("past-hours");

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden", "error");
  if (isError) statusMessage.classList.add("error");
}

function clearStatus() {
  statusMessage.classList.add("hidden");
}

function formatYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function fetchWeather(location) {
  if (!API_KEY || API_KEY === "TU_API_KEY_DE_WEATHERAPI") {
    setStatus("Por favor agrega tu API_KEY de WeatherAPI en app.js", true);
    return;
  }

  try {
    setStatus(`Cargando clima para "${location}"...`);
    weatherContent.classList.add("hidden");

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Historial de ayer (para cubrir las últimas 24 horas)
    const historyUrl = `${BASE_URL}/history.json?key=${API_KEY}&q=${encodeURIComponent(
      location
    )}&dt=${formatYYYYMMDD(yesterday)}&lang=es`;

    // 2. Pronóstico de hoy y mañana (incluye clima actual + horas futuras)
    const forecastUrl = `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(
      location
    )}&days=2&lang=es`;

    const [historyRes, forecastRes] = await Promise.all([
      fetch(historyUrl),
      fetch(forecastUrl),
    ]);

    if (!forecastRes.ok) {
      const errData = await forecastRes.json().catch(() => ({}));
      throw new Error(
        errData.error?.message || "No se encontró la ubicación o la API Key no es válida."
      );
    }

    const forecastData = await forecastRes.json();
    const historyData = historyRes.ok ? await historyRes.json() : null;

    currentLocationQuery = location;
    renderWeather(historyData, forecastData);

    clearStatus();
    weatherContent.classList.remove("hidden");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderWeather(historyData, forecastData) {
  const current = forecastData.current;
  const loc = forecastData.location;
  const nowEpoch = Math.floor(Date.now() / 1000);
  const twentyFourHoursSec = 24 * 3600;

  locationNameEl.textContent = `${loc.name}, ${loc.region || loc.country}`;
  currentDateEl.textContent = `Actualizado: ${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  weatherConditionEl.textContent = current.condition.text;
  currentTempEl.textContent = `${Math.round(current.temp_c)}°C`;
  currentWindEl.textContent = `${Math.round(current.wind_kph)} km/h`;

  // Unir horas de historial (si está disponible) y pronóstico (hoy + mañana)
  const allHours = [];

  if (historyData?.forecast?.forecastday) {
    historyData.forecast.forecastday.forEach((day) => {
      day.hour.forEach((h) => allHours.push(h));
    });
  }

  if (forecastData?.forecast?.forecastday) {
    forecastData.forecast.forecastday.forEach((day) => {
      day.hour.forEach((h) => allHours.push(h));
    });
  }

  // Evitar duplicados por time_epoch
  const uniqueHoursMap = new Map();
  allHours.forEach((h) => uniqueHoursMap.set(h.time_epoch, h));
  const sortedHours = Array.from(uniqueHoursMap.values()).sort(
    (a, b) => a.time_epoch - b.time_epoch
  );

  // Probabilidad de lluvia actual según la hora más cercana
  let closestHour = sortedHours[0];
  let minDiff = Infinity;
  sortedHours.forEach((h) => {
    const diff = Math.abs(h.time_epoch - nowEpoch);
    if (diff < minDiff) {
      minDiff = diff;
      closestHour = h;
    }
  });
  currentRainEl.textContent = `${closestHour?.chance_of_rain ?? 0}%`;

  const past24h = sortedHours.filter(
    (h) => h.time_epoch >= nowEpoch - twentyFourHoursSec && h.time_epoch < nowEpoch
  );

  const future24h = sortedHours.filter(
    (h) => h.time_epoch >= nowEpoch && h.time_epoch <= nowEpoch + twentyFourHoursSec
  );

  renderHourlyCards(pastHoursEl, past24h);
  renderHourlyCards(futureHoursEl, future24h);
}

function renderHourlyCards(container, hoursList) {
  container.innerHTML = "";

  if (!hoursList || hoursList.length === 0) {
    container.innerHTML = "<p class='subtitle'>No hay datos horarios disponibles.</p>";
    return;
  }

  hoursList.forEach((hour) => {
    const [datePart, timePart] = hour.time.split(" ");
    const card = document.createElement("div");
    card.className = "hour-card";
    card.innerHTML = `
      <span class="hour-date">${datePart}</span>
      <span class="hour-time">${timePart}</span>
      <span class="hour-temp">${Math.round(hour.temp_c)}°C</span>
      <span class="hour-meta">💧 ${hour.chance_of_rain ?? 0}%</span>
      <span class="hour-meta">💨 ${Math.round(hour.wind_kph)} km/h</span>
      <span class="hour-meta">${hour.condition.text}</span>
    `;
    container.appendChild(card);
  });
}

function loadUserLocation() {
  if (!("geolocation" in navigator)) {
    fetchWeather(currentLocationQuery);
    return;
  }

  setStatus("Detectando tu ubicación actual...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = `${position.coords.latitude},${position.coords.longitude}`;
      fetchWeather(coords);
    },
    () => {
      fetchWeather(currentLocationQuery);
    }
  );
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = locationInput.value.trim();
  if (query) {
    fetchWeather(query);
  }
});

refreshBtn.addEventListener("click", () => {
  fetchWeather(currentLocationQuery);
});

geoBtn.addEventListener("click", () => {
  loadUserLocation();
});

loadUserLocation();
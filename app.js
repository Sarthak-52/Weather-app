const API_KEY = '25bda456456874dfge5tg5yyh5e4'; // OpenWeatherMap API Key
const DEFAULT_CITY = 'Mathura';

// Firebase Stub - Only required for index.html context
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize state
let locations = JSON.parse(localStorage.getItem('aura_locations')) || ['Mathura', 'London', 'New York', 'Tokyo'];
if (!localStorage.getItem('aura_city')) localStorage.setItem('aura_city', DEFAULT_CITY);

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    onAuthStateChanged(auth, (user) => {
        if (!user && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    });

    // Page Specific Initialization
    if (document.getElementById('locations-container')) {
        initLocationsPage();
    } else if (document.getElementById('forecast-container')) {
        initForecast();
    } else if (document.getElementById('current-temp')) {
        initDashboard();
    }
    
    // Search listener
    const searchInput = document.getElementById('city-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                localStorage.setItem('aura_city', e.target.value);
                initDashboard();
                e.target.value = '';
            }
        });
    }
});

async function initDashboard() {
    const city = localStorage.getItem('aura_city') || DEFAULT_CITY;
    console.log(`[Weather App] Initiating sync for: ${city}`);
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`);
        const data = await response.json();
        if (data.cod !== 200) throw new Error(data.message);
        
        // Fetch AQI using coords
        const lat = data.coord.lat;
        const lon = data.coord.lon;
        const aqiResponse = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        const aqiData = await aqiResponse.json();
        const aqi = aqiData.list[0].main.aqi;
        
        console.log(`[Weather App] Received data for: ${data.name}, AQI: ${aqi}`);
        updateDashboardUI(data, aqi);
    } catch (err) {
        console.error('[Weather App] Sync Failed:', err);
    }
}

function updateDashboardUI(data, aqi) {
    if (!document.getElementById('current-temp')) return;
    
    document.getElementById('current-location').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('current-temp').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('weather-desc').textContent = `${data.weather[0].main} — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`;
    
    document.getElementById('humidity-val').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-val').textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
    document.getElementById('pressure-val').textContent = `${data.main.pressure} hPa`;
    document.getElementById('vis-val').textContent = `${(data.visibility / 1000).toFixed(1)} km`;

    const aqiLevels = {
        1: '1 Good', 2: '2 Fair', 3: '3 Moderate', 4: '4 Poor', 5: '5 Very Poor'
    };
    if (document.getElementById('aqi-val')) {
        document.getElementById('aqi-val').textContent = aqiLevels[aqi] || 'N/A';
    }

    if (document.getElementById('feels-like-val')) {
        document.getElementById('feels-like-val').textContent = `${Math.round(data.main.feels_like)}°C`;
    }
    if (document.getElementById('temp-range-val')) {
        document.getElementById('temp-range-val').textContent = `${Math.round(data.main.temp_min)}° / ${Math.round(data.main.temp_max)}°`;
    }

    const iconCode = data.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    document.getElementById('hero-icon').innerHTML = `<img src="${iconUrl}" width="160" height="160" style="filter: drop-shadow(0 0 20px rgba(255,255,255,0.3))">`;
}

async function initForecast() {
    const city = localStorage.getItem('aura_city') || DEFAULT_CITY;
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`);
        const data = await response.json();
        const forecastContainer = document.getElementById('forecast-container');
        if (!forecastContainer) return;
        forecastContainer.innerHTML = '';
        const dailyData = data.list.filter(item => item.dt_txt.includes('12:00:00'));
        dailyData.forEach((day) => {
            const date = new Date(day.dt * 1000);
            const row = document.createElement('div');
            row.className = `forecast-row`;
            row.innerHTML = `
                <div class="forecast-day">${date.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                <div style="width: 150px; font-family: 'Space Grotesk'; font-size: 0.875rem; color: var(--primary);">
                    <span style="opacity: 0.6;">Precipitation: </span>${Math.round(day.pop * 100)}%
                    <br>
                    <span style="opacity: 0.6;">Humidity: </span>${day.main.humidity}%
                </div>
                <div class="forecast-temp-main">${Math.round(day.main.temp)}°</div>
                <div class="metric-label" style="text-align: right; width: 100px;">
                    <span style="opacity: 0.6;">LOW</span> ${Math.round(day.main.temp_min)}°
                    <br>
                    <span style="opacity: 1; color: #ffffff;">HIGH</span> ${Math.round(day.main.temp_max)}°
                </div>
            `;
            forecastContainer.appendChild(row);
        });
    } catch (err) {
        console.error('Error fetching forecast:', err);
    }
}

function initLocationsPage() {
    const container = document.getElementById('locations-container');
    if (!container) return;
    container.innerHTML = '';
    locations.forEach(city => {
        const card = document.createElement('div');
        card.className = 'widget-card';
        card.style.cursor = 'pointer';
        card.style.position = 'relative';
        card.innerHTML = `
            <div onclick="selectCity('${city}')">
                <span class="widget-title">City</span>
                <span class="widget-value">${city}</span>
            </div>
            <button onclick="removeLocation(event, '${city}')" style="position: absolute; top: 16px; right: 16px; background: rgba(239, 68, 68, 0.2); border: none; color: #ef4444; border-radius: 8px; padding: 4px 8px; cursor: pointer; font-family: 'Space Grotesk'; font-size: 0.75rem;">Remove</button>
        `;
        container.appendChild(card);
    });
}

window.addLocation = function() {
    const input = document.getElementById('new-location-input');
    const city = input.value.trim();
    if (city && !locations.includes(city)) {
        locations.push(city);
        localStorage.setItem('aura_locations', JSON.stringify(locations));
        initLocationsPage();
        input.value = '';
    }
};

window.removeLocation = function(event, city) {
    event.stopPropagation();
    locations = locations.filter(l => l !== city);
    localStorage.setItem('aura_locations', JSON.stringify(locations));
    initLocationsPage();
};

window.selectCity = function(city) {
    localStorage.setItem('aura_city', city);
    window.location.href = 'index.html';
};

window.handleSignOut = async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (err) {
        console.error('Sign Out Failed:', err);
    }
};

// Sync between tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'aura_city') {
        if (document.getElementById('current-temp')) initDashboard();
        if (document.getElementById('forecast-container')) initForecast();
    }
});

console.log('Weather App Authenticated — Made by Sarthak');

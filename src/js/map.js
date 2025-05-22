/**
 * Hlavní JavaScript soubor pro práci s mapou
 */

// Import konfigurace a služeb
import config from '../../config/config.js';
import { gooutService, kudyznudyService } from '../services/api.js';
import { getUserLocation as getLocation, calculateDistance } from '../utils/mapUtils.js';
import { addActivitiesToMap, createFilterControl } from '../components/mapComponents.js';
import { disableCache } from '../utils/cacheUtils.js';

// Globální proměnné
let map;
let activityMarkers = [];
let userMarker = null;
let currentUserLocation = null;
let filteredCategories = [...config.activities.categories];

// Počkáme, až se dokument načte
document.addEventListener('DOMContentLoaded', function() {
    // Zakázání cache pro vývojové prostředí
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        disableCache();
        console.log('Vývojové prostředí detekováno - cache zakázána');
    }

    // Inicializace mapy
    initMap();

    // Přidání ovládacích prvků
    addControls();

    // Přidání posluchačů událostí
    setupEventListeners();
});

/**
 * Inicializace mapy
 */
function initMap() {
    // Inicializace mapy s výchozím pohledem
    map = L.map('map').setView(config.map.defaultCenter, config.map.defaultZoom);

    // Přidání mapového podkladu
    L.tileLayer(config.map.tileLayer, {
        attribution: config.map.attribution,
        minZoom: config.map.minZoom,
        maxZoom: config.map.maxZoom
    }).addTo(map);

    // Přidání ovládacího prvku pro filtrování
    createFilterControl(map, config.activities.categories, handleFilterChange);
}

/**
 * Přidání ovládacích prvků do mapy
 */
function addControls() {
    // Přidání tlačítka pro lokalizaci
    const locationButton = document.createElement('button');
    locationButton.textContent = 'Moje poloha';
    locationButton.className = 'map-button';
    locationButton.id = 'location-button';
    locationButton.onclick = handleLocationRequest;

    // Přidání tlačítka pro načtení aktivit
    const loadActivitiesButton = document.createElement('button');
    loadActivitiesButton.textContent = 'Načíst aktivity v okolí';
    loadActivitiesButton.className = 'map-button';
    loadActivitiesButton.id = 'load-activities-button';
    loadActivitiesButton.onclick = handleLoadActivities;
    loadActivitiesButton.disabled = true; // Zpočátku zakázáno, dokud nemáme polohu

    // Přidání tlačítek do overlay panelu
    const overlay = document.querySelector('.map-overlay');
    const controlDiv = document.createElement('div');
    controlDiv.className = 'map-control';
    controlDiv.appendChild(locationButton);
    controlDiv.appendChild(loadActivitiesButton);
    overlay.appendChild(controlDiv);

    // Přidání informačního textu
    const infoText = document.createElement('p');
    infoText.id = 'info-text';
    infoText.className = 'info-text';
    infoText.textContent = 'Klikněte na "Moje poloha" pro zjištění vaší aktuální polohy.';
    overlay.appendChild(infoText);
}

/**
 * Nastavení posluchačů událostí
 */
function setupEventListeners() {
    // Posluchač události pro změnu velikosti okna
    window.addEventListener('resize', function() {
        // Aktualizace velikosti mapy při změně velikosti okna
        if (map) {
            map.invalidateSize();
        }
    });

    // Posluchač události pro kliknutí na mapu
    map.on('click', function(e) {
        // Zde můžeme přidat funkcionalitu pro kliknutí na mapu
        console.log('Kliknuto na mapu na souřadnicích:', e.latlng);
    });
}

/**
 * Obsluha požadavku na zjištění polohy
 */
async function handleLocationRequest() {
    try {
        // Získání polohy uživatele
        const location = await getLocation();
        currentUserLocation = location;

        // Aktualizace informačního textu
        updateInfoText(`Vaše poloha: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);

        // Přesun mapy na polohu uživatele
        map.setView([location.lat, location.lng], 13);

        // Přidání nebo aktualizace markeru s polohou uživatele
        if (userMarker) {
            userMarker.setLatLng([location.lat, location.lng]);
        } else {
            userMarker = L.marker([location.lat, location.lng])
                .addTo(map)
                .bindPopup('Vaše aktuální poloha')
                .openPopup();
        }

        // Povolení tlačítka pro načtení aktivit
        document.getElementById('load-activities-button').disabled = false;
    } catch (error) {
        updateInfoText(`Chyba: ${error.message}`);
        console.error('Chyba při získávání polohy:', error);
    }
}

/**
 * Obsluha požadavku na načtení aktivit
 */
async function handleLoadActivities() {
    if (!currentUserLocation) {
        updateInfoText('Nejprve je potřeba zjistit vaši polohu.');
        return;
    }

    try {
        updateInfoText('Načítání aktivit...');

        // Odstranění stávajících markerů
        clearActivityMarkers();

        // Získání aktivit z GoOut
        const gooutEvents = await gooutService.getEventsNearby(
            currentUserLocation.lat,
            currentUserLocation.lng,
            config.activities.defaultRadius
        );

        // Získání aktivit z KudyZNudy
        const kudyznudyActivities = await kudyznudyService.getActivitiesNearby(
            currentUserLocation.lat,
            currentUserLocation.lng,
            config.activities.defaultRadius
        );

        // Sloučení aktivit
        const allActivities = [...gooutEvents, ...kudyznudyActivities];

        // Filtrování podle kategorií
        const filteredActivities = allActivities.filter(activity =>
            filteredCategories.includes(activity.category)
        );

        // Přidání aktivit na mapu
        activityMarkers = addActivitiesToMap(map, filteredActivities);

        updateInfoText(`Načteno ${filteredActivities.length} aktivit v okolí.`);
    } catch (error) {
        updateInfoText(`Chyba při načítání aktivit: ${error.message}`);
        console.error('Chyba při načítání aktivit:', error);
    }
}

/**
 * Obsluha změny filtru kategorií
 * @param {Array<string>} categories - vybrané kategorie
 */
function handleFilterChange(categories) {
    filteredCategories = categories;

    // Pokud máme načtené aktivity a polohu uživatele, znovu načteme aktivity s novým filtrem
    if (currentUserLocation && activityMarkers.length > 0) {
        handleLoadActivities();
    }
}

/**
 * Odstranění všech markerů aktivit z mapy
 */
function clearActivityMarkers() {
    activityMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    activityMarkers = [];
}

/**
 * Aktualizace informačního textu
 * @param {string} text - nový text
 */
function updateInfoText(text) {
    const infoText = document.getElementById('info-text');
    if (infoText) {
        infoText.textContent = text;
    }
}

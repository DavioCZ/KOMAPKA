/**
 * Utility funkce pro práci s mapou
 */

/**
 * Vypočítá vzdálenost mezi dvěma body na Zemi (Haversine formula)
 * @param {number} lat1 - zeměpisná šířka prvního bodu
 * @param {number} lon1 - zeměpisná délka prvního bodu
 * @param {number} lat2 - zeměpisná šířka druhého bodu
 * @param {number} lon2 - zeměpisná délka druhého bodu
 * @returns {number} - vzdálenost v kilometrech
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Poloměr Země v km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

/**
 * Převede stupně na radiány
 * @param {number} degrees - úhel ve stupních
 * @returns {number} - úhel v radiánech
 */
function toRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Získá aktuální polohu uživatele pomocí Geolocation API
 * @returns {Promise<{lat: number, lng: number}>} - objekt s polohou
 */
export function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolokace není podporována vaším prohlížečem.'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                let errorMessage;
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Uživatel odmítl sdílet svou polohu.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Informace o poloze není dostupná.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Vypršel časový limit pro získání polohy.";
                        break;
                    case error.UNKNOWN_ERROR:
                        errorMessage = "Nastala neznámá chyba při získávání polohy.";
                        break;
                }
                reject(new Error(errorMessage));
            }
        );
    });
}

/**
 * Vytvoří ikonu markeru podle kategorie
 * @param {string} category - kategorie aktivity
 * @returns {L.Icon} - ikona pro marker
 */
export function createMarkerIcon(category) {
    // Předpokládá se, že používáme Leaflet.js
    if (typeof L === 'undefined') {
        console.error('Leaflet není načten');
        return null;
    }
    
    // Barvy podle kategorie
    const colors = {
        'kultura': 'red',
        'sport': 'blue',
        'gastronomie': 'green',
        'příroda': 'darkgreen',
        'zábava': 'purple',
        'default': 'gray'
    };
    
    const color = colors[category] || colors.default;
    
    return L.divIcon({
        className: `marker-icon marker-${color}`,
        html: `<div style="background-color: ${color}"></div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 12]
    });
}

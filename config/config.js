/**
 * Konfigurační soubor pro aplikaci KOMAPKA
 * Obsahuje základní nastavení aplikace, API klíče a další konfigurační parametry
 */

const config = {
    // Základní nastavení aplikace
    app: {
        name: 'KOMAPKA',
        version: '1.0.0',
        description: 'Mapová aplikace pro zobrazení aktivit a událostí'
    },
    
    // Nastavení mapy
    map: {
        defaultCenter: [49.8175, 15.4730], // Výchozí střed mapy (ČR)
        defaultZoom: 8,                    // Výchozí přiblížení
        minZoom: 5,                        // Minimální povolené přiblížení
        maxZoom: 19,                       // Maximální povolené přiblížení
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    
    // API klíče a endpointy
    api: {
        goout: {
            baseUrl: 'https://api.goout.net/',
            apiKey: 'YOUR_GOOUT_API_KEY' // Nahraďte skutečným API klíčem
        },
        kudyznudy: {
            baseUrl: 'https://www.kudyznudy.cz/',
            // Poznámka: KudyZNudy nemá veřejné API, používáme scraping
        }
    },
    
    // Nastavení pro vyhledávání aktivit
    activities: {
        defaultRadius: 10, // km
        maxRadius: 50,     // km
        defaultLimit: 20,  // počet výsledků
        categories: [
            'kultura',
            'sport',
            'gastronomie',
            'příroda',
            'zábava'
        ]
    }
};

// Export konfigurace
export default config;

// src/services/search/searchAPI.js
import { searchService } from './searchService.js';

// Pomocná funkce pro zajištění inicializace
async function ensureInitialized() {
    if (!searchService.isInitialized) {
        try {
            await searchService.initialize();
        } catch (error) {
            console.error("searchAPI: Nepodařilo se inicializovat searchService:", error);
            throw new Error("Systém vyhledávání se nepodařilo inicializovat.");
        }
    }
}

export const searchAPI = {
    /**
     * Provede vyhledávání na základě dotazu a volitelných parametrů.
     * @param {string} query - Vyhledávací dotaz.
     * @param {object} [options] - Volitelné parametry.
     * @param {L.LatLngBounds} [options.bounds] - Hranice mapy pro filtrování.
     * @param {object} [options.filters] - Objekt s detailními filtry (např. { categories: ['Sport'] }).
     * @returns {Promise<object>} - Promise s výsledky vyhledávání.
     */
    search: async (query, options) => {
        await ensureInitialized();
        // Zajistíme, že options je vždy objekt, i když není předán
        return searchService.search(query, options || {});
    },

    getSuggestions: async (query) => {
        await ensureInitialized();
        return searchService.getSuggestions(query);
    },

    geocodeLocation: async (query) => {
        await ensureInitialized();
        return searchService.geocodeLocation(query);
    },

    /**
     * Vyhledá položky v okolí dané geolokace.
     * @param {number} lat - Zeměpisná šířka.
     * @param {number} lng - Zeměpisná délka.
     * @param {number} radius - Poloměr vyhledávání v km.
     * @param {object} [options] - Volitelné parametry, např. { filters: {} }
     * @returns {Promise<object>} - Promise s výsledky vyhledávání.
     */
    searchByLocation: async (lat, lng, radius, options) => {
        await ensureInitialized();
        return searchService.searchByLocation(lat, lng, radius, options || {});
    },

    fetchUniqueCategories: async () => {
        await ensureInitialized();
        return searchService.getUniqueCategories();
    },

    /**
     * Získá unikátní hodnoty pro zadané pole z dat aktivit.
     * @param {string} fieldName - Název pole, pro které chceme získat unikátní hodnoty.
     * @returns {Promise<string[]>} - Promise s polem unikátních hodnot.
     */
    getUniqueFilterValues: async (fieldName) => {
        await ensureInitialized();
        return searchService.getUniqueFilterValues(fieldName);
    }
};
/**
 * API služby pro komunikaci s externími zdroji dat
 */

import config from '../../config/config.js';

/**
 * Služba pro získávání dat z GoOut API
 */
export const gooutService = {
    /**
     * Získá události v okolí zadané lokace
     * @param {number} lat - zeměpisná šířka
     * @param {number} lng - zeměpisná délka
     * @param {number} radius - poloměr vyhledávání v km
     * @param {number} limit - maximální počet výsledků
     * @returns {Promise<Array>} - pole událostí
     */
    getEventsNearby: async (lat, lng, radius = config.activities.defaultRadius, limit = config.activities.defaultLimit) => {
        try {
            // Simulovaná data - v reálné aplikaci by zde byl API požadavek
            console.log(`Fetching GoOut events near [${lat}, ${lng}] within ${radius} km`);
            
            // Simulace zpoždění API
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Simulovaná data
            return [
                {
                    id: 'go1',
                    name: 'Koncert v parku',
                    location: {
                        name: 'Městský park',
                        lat: lat + 0.01,
                        lng: lng - 0.01
                    },
                    date: '2025-05-10T18:00:00',
                    category: 'kultura',
                    url: 'https://goout.net/cs/koncert-v-parku/123456'
                },
                {
                    id: 'go2',
                    name: 'Divadelní představení',
                    location: {
                        name: 'Městské divadlo',
                        lat: lat - 0.02,
                        lng: lng + 0.03
                    },
                    date: '2025-05-12T19:30:00',
                    category: 'kultura',
                    url: 'https://goout.net/cs/divadelni-predstaveni/789012'
                }
            ];
        } catch (error) {
            console.error('Error fetching GoOut events:', error);
            return [];
        }
    }
};

/**
 * Služba pro získávání dat z KudyZNudy (scraping)
 */
export const kudyznudyService = {
    /**
     * Získá aktivity v okolí zadané lokace
     * @param {number} lat - zeměpisná šířka
     * @param {number} lng - zeměpisná délka
     * @param {number} radius - poloměr vyhledávání v km
     * @param {number} limit - maximální počet výsledků
     * @returns {Promise<Array>} - pole aktivit
     */
    getActivitiesNearby: async (lat, lng, radius = config.activities.defaultRadius, limit = config.activities.defaultLimit) => {
        try {
            // Simulovaná data - v reálné aplikaci by zde byl scraping nebo API požadavek
            console.log(`Fetching KudyZNudy activities near [${lat}, ${lng}] within ${radius} km`);
            
            // Simulace zpoždění
            await new Promise(resolve => setTimeout(resolve, 700));
            
            // Simulovaná data
            return [
                {
                    id: 'kzn1',
                    name: 'Prohlídka hradu',
                    location: {
                        name: 'Hrad Karlštejn',
                        lat: lat + 0.05,
                        lng: lng + 0.02
                    },
                    category: 'kultura',
                    url: 'https://www.kudyznudy.cz/aktivity/hrad-karlstejn'
                },
                {
                    id: 'kzn2',
                    name: 'Cyklovýlet podél řeky',
                    location: {
                        name: 'Cyklostezka',
                        lat: lat - 0.03,
                        lng: lng - 0.04
                    },
                    category: 'sport',
                    url: 'https://www.kudyznudy.cz/aktivity/cyklovylet-podél-reky'
                }
            ];
        } catch (error) {
            console.error('Error fetching KudyZNudy activities:', error);
            return [];
        }
    }
};

/**
 * Komponenty pro práci s mapou
 */

import { createMarkerIcon } from '../utils/mapUtils.js';

/**
 * Vytvoří a přidá markery aktivit na mapu
 * @param {L.Map} map - instance mapy Leaflet
 * @param {Array} activities - pole aktivit k zobrazení
 * @returns {Array<L.Marker>} - pole vytvořených markerů
 */
export function addActivitiesToMap(map, activities) {
    if (!map || !activities || !Array.isArray(activities)) {
        console.error('Neplatné parametry pro přidání aktivit na mapu');
        return [];
    }
    
    const markers = [];
    
    activities.forEach(activity => {
        if (!activity.location || !activity.location.lat || !activity.location.lng) {
            console.warn('Aktivita nemá platnou lokaci:', activity);
            return;
        }
        
        const marker = L.marker(
            [activity.location.lat, activity.location.lng],
            { icon: createMarkerIcon(activity.category) }
        );
        
        // Vytvoření popup obsahu
        const popupContent = `
            <div class="activity-popup">
                <h3>${activity.name}</h3>
                <p>${activity.location.name}</p>
                ${activity.date ? `<p>Datum: ${new Date(activity.date).toLocaleDateString('cs-CZ')}</p>` : ''}
                <p>Kategorie: ${activity.category}</p>
                <a href="${activity.url}" target="_blank" rel="noopener noreferrer">Více informací</a>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        marker.addTo(map);
        markers.push(marker);
    });
    
    return markers;
}

/**
 * Vytvoří ovládací panel pro filtrování aktivit
 * @param {L.Map} map - instance mapy Leaflet
 * @param {Array<string>} categories - pole kategorií pro filtrování
 * @param {Function} onFilterChange - callback funkce volaná při změně filtru
 * @returns {L.Control} - ovládací prvek pro filtrování
 */
export function createFilterControl(map, categories, onFilterChange) {
    // Vytvoření vlastního ovládacího prvku
    const FilterControl = L.Control.extend({
        options: {
            position: 'topright'
        },
        
        onAdd: function() {
            const container = L.DomUtil.create('div', 'map-filter-control');
            container.innerHTML = `
                <div class="filter-header">
                    <h4>Filtrovat aktivity</h4>
                </div>
                <div class="filter-categories">
                    ${categories.map(category => `
                        <div class="filter-category">
                            <input type="checkbox" id="filter-${category}" value="${category}" checked>
                            <label for="filter-${category}">${category}</label>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Zabránění propagace událostí kliknutí na mapu
            L.DomEvent.disableClickPropagation(container);
            
            // Přidání posluchačů událostí
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                L.DomEvent.on(checkbox, 'change', function() {
                    const selectedCategories = [];
                    checkboxes.forEach(cb => {
                        if (cb.checked) {
                            selectedCategories.push(cb.value);
                        }
                    });
                    
                    if (typeof onFilterChange === 'function') {
                        onFilterChange(selectedCategories);
                    }
                });
            });
            
            return container;
        }
    });
    
    const filterControl = new FilterControl();
    map.addControl(filterControl);
    
    return filterControl;
}

/**
 * search.js
 * Hlavní JavaScript soubor pro vyhledávání v aplikaci KOMAPKA
 */

import { searchAPI } from '../services/search/searchAPI.js';
import {
    createSearchField,
    displaySearchResults,
    hideSuggestions,
    createFilterPanel, // Nově importováno
    toggleFilterPanelVisibility // Nově importováno
} from '../components/searchComponents.js';

// Globální proměnné na úrovni modulu
let mapInstance;
let markersLayerGroup;
let currentlySelectedMarker = null;
let lastGeneralSearchResults = null;
let lastGeneralSearchQuery = "";

let infoPanelElement;
let infoContentElement;
let mapOverlayBgElement;
let categoryFilterBarContainer;
let toggleInfoPanelButton;
let searchBarContainer; // Přidáno pro panel filtrů

let isCategorySearch = false;
let currentActiveFilters = {}; // Pro uložení aktivních detailních filtrů

// --- Definice ikon pro markery --- (zůstává stejné)
const DEFAULT_MARKER_OPACITY = 0.8;
const HIGHLIGHTED_MARKER_OPACITY = 1.0;
const DEFAULT_ZINDEX = 500;
const HIGHLIGHTED_ZINDEX = 1000;

// Použijeme divIcon pro vlastní modrý marker
const defaultActivityIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #3388ff;"></i>',
    className: 'komapka-map-marker activity-marker default-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});
// Použijeme divIcon pro vlastní žlutý marker
const highlightedActivityIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #FACC15;"></i>',
    className: 'komapka-map-marker activity-marker highlighted-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
});

const defaultPlaceIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt"></i>',
    className: 'komapka-map-marker place-marker default-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 30]
});
const highlightedPlaceIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #FACC15;"></i>',
    className: 'komapka-map-marker place-marker highlighted-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36]
});
// Konec definice ikon

// Exportujeme funkci hidePanelCompletely pro použití v index.html
export { hidePanelCompletely };

export async function initSearch(leafletMapInstance) {
    mapInstance = leafletMapInstance;

    console.log("Initializing search system...");
    infoPanelElement = document.getElementById('info-panel');
    infoContentElement = document.getElementById('info-content');
    mapOverlayBgElement = document.getElementById('map-overlay-bg');
    categoryFilterBarContainer = document.getElementById('category-filter-bar-container');
    toggleInfoPanelButton = document.getElementById('toggle-info-panel-btn');
    searchBarContainer = document.getElementById('search-bar-container'); // Kontejner pro vyhledávací lištu

    if (!infoPanelElement || !infoContentElement) {
        console.error("Chyba: Informační panel (#info-panel nebo #info-content) nebyl nalezen.");
    }
    if (!toggleInfoPanelButton) {
        console.warn("Tlačítko pro přepínání panelu (#toggle-info-panel-btn) nebylo nalezeno.");
    } else {
        toggleInfoPanelButton.addEventListener('click', togglePanelState);
    }

    // Přidáme obsluhu tlačítek pro zavření panelu
    const closeInfoPanelExplicitlyButton = document.getElementById('close-info-panel-explicitly-btn');
    if (!closeInfoPanelExplicitlyButton) {
        console.warn("Tlačítko pro explicitní zavření panelu (#close-info-panel-explicitly-btn) nebylo nalezeno.");
    } else {
        closeInfoPanelExplicitlyButton.addEventListener('click', hidePanelCompletely);
    }

    // Přidáme obsluhu tlačítka pro zavření v pravém horním rohu (pokud existuje)
    const closeInfoPanelBtn = document.getElementById('close-info-panel-btn');
    if (closeInfoPanelBtn) {
        closeInfoPanelBtn.addEventListener('click', hidePanelCompletely);
    }

    // Přidáme obsluhu kliknutí na overlay pozadí
    if (mapOverlayBgElement) {
        mapOverlayBgElement.addEventListener('click', hidePanelCompletely);
    }

    // Scroll listener pro categoryFilterBarContainer (zůstává stejný)
    if (!categoryFilterBarContainer) {
        console.error("Chyba: Kontejner pro filtry kategorií (#category-filter-bar-container) nebyl nalezen.");
    } else {
        // ... (původní kód pro wheel, mouseenter, mouseleave) ...
        categoryFilterBarContainer.addEventListener('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const filterBar = categoryFilterBarContainer.querySelector('.category-filters-bar');
            if (filterBar) {
                let pixelsToScroll;
                const PIXELS_PER_LINE = 12;
                const MOUSE_WHEEL_LARGE_DELTA_THRESHOLD = 40;
                const MOUSE_WHEEL_DAMPEN_FACTOR = 0.4;
                const FINE_SCROLL_PIXEL_MULTIPLIER = 3;

                if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
                    if (Math.abs(event.deltaY) > MOUSE_WHEEL_LARGE_DELTA_THRESHOLD) {
                        pixelsToScroll = event.deltaY * MOUSE_WHEEL_DAMPEN_FACTOR;
                    } else {
                        pixelsToScroll = event.deltaY * FINE_SCROLL_PIXEL_MULTIPLIER;
                    }
                } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
                    pixelsToScroll = event.deltaY * PIXELS_PER_LINE;
                } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
                    pixelsToScroll = event.deltaY * filterBar.clientWidth * 0.8;
                } else {
                    pixelsToScroll = event.deltaY * 5;
                }
                filterBar.scrollBy({ left: pixelsToScroll, behavior: 'auto' });
            }
        }, { passive: false, useCapture: true });

        categoryFilterBarContainer.addEventListener('mouseenter', () => {
            const filterBar = categoryFilterBarContainer.querySelector('.category-filters-bar');
            if (filterBar) {
                filterBar.style.overflowX = 'auto';
            }
        });

        categoryFilterBarContainer.addEventListener('mouseleave', () => {
            const filterBar = categoryFilterBarContainer.querySelector('.category-filters-bar');
            if (filterBar) {
                filterBar.style.overflowX = 'hidden';
            }
        });
    }

    if (typeof L.markerClusterGroup === 'function') {
        markersLayerGroup = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 50,
        });
    } else {
        console.warn("Leaflet.markercluster není načteno, používá se L.FeatureGroup.");
        markersLayerGroup = L.featureGroup();
    }
    mapInstance.addLayer(markersLayerGroup);

    if (searchBarContainer && typeof createSearchField === 'function') {
        // Úprava volání createSearchField pro přidání callbacku pro tlačítko filtru
        createSearchField(searchBarContainer, handleSearchCallback, handleFilterButtonClick);

        try {
            // Získání unikátních hodnot pro filtry
            const [
                categoriesForFilterPanel,
                vhodnostProValues,
                prostrediValues,
                zamereniValues,
                formatAkceValues,
                jazykAkceValues,
                rezervaceVstupneValues,
                denniDobaValues
            ] = await Promise.all([
                searchAPI.fetchUniqueCategories(),
                searchAPI.getUniqueFilterValues('vhodnost_pro'),
                searchAPI.getUniqueFilterValues('prostredi'),
                searchAPI.getUniqueFilterValues('zamereni'),
                searchAPI.getUniqueFilterValues('format_akce'),
                searchAPI.getUniqueFilterValues('jazyk_akce'),
                searchAPI.getUniqueFilterValues('rezervace_vstupne'),
                searchAPI.getUniqueFilterValues('denni_doba')
            ]);

            // Vytvoření objektu s unikátními hodnotami pro filtry
            const filterValues = {
                categories: categoriesForFilterPanel,
                vhodnostPro: vhodnostProValues,
                prostredi: prostrediValues,
                zamereni: zamereniValues,
                formatAkce: formatAkceValues,
                jazykAkce: jazykAkceValues,
                rezervaceVstupne: rezervaceVstupneValues,
                denniDoba: denniDobaValues
            };

            // Inicializace panelu filtrů s unikátními hodnotami
            createFilterPanel(searchBarContainer, filterValues, handleApplyFilters);
        } catch (error) {
            console.error('Chyba při získávání unikátních hodnot pro filtry:', error);
            // Fallback - vytvoření panelu filtrů s prázdnými hodnotami
            createFilterPanel(searchBarContainer, [], handleApplyFilters);
        }
    } else {
        console.error('Kontejner pro vyhledávací pole (#search-bar-container) nebo funkce createSearchField/createFilterPanel nejsou k dispozici.');
    }

    // Funkce pro zpracování změny pohledu na mapě s debounce mechanismem
    let debounceTimeout;
    let loadingIndicatorTimeout;
    let lastBoundsString = ''; // Pro sledování změn bounds
    let lastUsedBounds = null; // Pro sledování změn bounds s tolerancí
    let lastUsedZoom = null; // Pro sledování změn zoomu
    let lastUsedBufferBounds = null; // Pro sledování změn buffer bounds

    // Vytvoříme indikátor načítání
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'map-loading-indicator';
    loadingIndicator.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    loadingIndicator.style.display = 'none';
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '10px';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translateX(-50%)';
    loadingIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingIndicator.style.padding = '5px 10px';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    loadingIndicator.style.zIndex = '1000';
    document.body.appendChild(loadingIndicator);

    function showLoadingIndicator() {
        loadingIndicator.style.display = 'block';
    }

    function hideLoadingIndicator() {
        loadingIndicator.style.display = 'none';
    }

    /**
     * Funkce pro kontrolu, zda se bounds významně změnily
     * @param {L.LatLngBounds} oldBounds - Předchozí bounds
     * @param {L.LatLngBounds} newBounds - Nové bounds
     * @param {number} tolerancePercent - Tolerance v procentech (10 = 10%)
     * @returns {boolean} - True pokud se bounds významně změnily, jinak false
     */
    function boundsChangedSignificantly(oldBounds, newBounds, tolerancePercent = 10) {
        if (!oldBounds) return true;

        // Pokud se změnil zoom, považujeme to za významnou změnu
        const currentZoom = mapInstance.getZoom();
        if (lastUsedZoom !== currentZoom) {
            console.log(`Změna zoomu z ${lastUsedZoom} na ${currentZoom}, považuji za významnou změnu.`);
            return true;
        }

        // Získáme středy obou bounds
        const oldCenter = oldBounds.getCenter();
        const newCenter = newBounds.getCenter();

        // Vypočítáme šířku a výšku starých bounds
        const oldWidth = oldBounds.getEast() - oldBounds.getWest();
        const oldHeight = oldBounds.getNorth() - oldBounds.getSouth();

        // Vypočítáme toleranci jako procento z rozměrů
        const latThreshold = oldHeight * (tolerancePercent / 100);
        const lngThreshold = oldWidth * (tolerancePercent / 100);

        // Vypočítáme rozdíl mezi středy
        const latDiff = Math.abs(oldCenter.lat - newCenter.lat);
        const lngDiff = Math.abs(oldCenter.lng - newCenter.lng);

        // Pokud je rozdíl větší než tolerance, bounds se významně změnily
        const isSignificantChange = latDiff > latThreshold || lngDiff > lngThreshold;

        if (isSignificantChange) {
            console.log(`Významná změna bounds: latDiff=${latDiff.toFixed(6)}, lngDiff=${lngDiff.toFixed(6)}, latThreshold=${latThreshold.toFixed(6)}, lngThreshold=${lngThreshold.toFixed(6)}`);
        } else {
            console.log(`Nevýznamná změna bounds: latDiff=${latDiff.toFixed(6)}, lngDiff=${lngDiff.toFixed(6)}, latThreshold=${latThreshold.toFixed(6)}, lngThreshold=${lngThreshold.toFixed(6)}`);
        }

        return isSignificantChange;
    }

    /**
     * Funkce pro výpočet rozšířených hranic (buffer bounds) pro nárazníkovou zónu
     * @param {L.LatLngBounds} bounds - Aktuální hranice mapy
     * @param {number} bufferFactor - Faktor rozšíření (1.5 = rozšíření o 50%)
     * @returns {L.LatLngBounds} - Rozšířené hranice
     */
    function calculateBufferBounds(bounds, bufferFactor = 0.5) {
        // Použijeme metodu pad z Leaflet, která rozšíří bounds o zadaný faktor
        // bufferFactor 0.5 znamená rozšíření o 50% v každém směru
        return bounds.pad(bufferFactor);
    }

    function debouncedPerformSearch() {
        // Zrušíme předchozí timeouty
        clearTimeout(debounceTimeout);
        clearTimeout(loadingIndicatorTimeout);

        // Získáme aktuální bounds
        const currentBounds = mapInstance.getBounds();
        const currentBoundsString = currentBounds.toBBoxString();
        const currentZoom = mapInstance.getZoom();

        // Vypočítáme rozšířené hranice (buffer bounds) pro nárazníkovou zónu
        // Faktor rozšíření závisí na úrovni zoomu - při větším zoomu (detailnější pohled) menší buffer
        const bufferFactor = currentZoom > 14 ? 0.3 : (currentZoom > 10 ? 0.5 : 0.7);
        const bufferBounds = calculateBufferBounds(currentBounds, bufferFactor);
        const bufferBoundsString = bufferBounds.toBBoxString();

        // Získáme aktuální query z inputu
        const searchInput = document.querySelector('.search-input');
        const query = searchInput ? searchInput.value.trim() : lastGeneralSearchQuery;

        // Pokud se bounds nezměnily a máme již výsledky, není třeba znovu vyhledávat
        if (currentBoundsString === lastBoundsString && lastGeneralSearchResults) {
            console.log('Bounds se nezměnily (přesná shoda), přeskakuji vyhledávání.');
            return;
        }

        // Kontrola, zda se bounds změnily dostatečně významně
        if (lastUsedBounds && lastGeneralSearchResults && !boundsChangedSignificantly(lastUsedBounds, currentBounds)) {
            console.log('Bounds se nezměnily dostatečně významně, přeskakuji vyhledávání.');
            return;
        }

        // Kontrola, zda jsou aktuální bounds stále uvnitř posledních buffer bounds
        // Pokud ano a máme již výsledky, není třeba znovu vyhledávat
        if (lastUsedBufferBounds && lastGeneralSearchResults &&
            lastUsedBufferBounds.contains(currentBounds) &&
            lastUsedZoom === currentZoom) {
            console.log('Aktuální bounds jsou stále uvnitř posledních buffer bounds, přeskakuji vyhledávání.');
            // Aktualizujeme pouze lastBoundsString a lastUsedBounds
            lastBoundsString = currentBoundsString;
            lastUsedBounds = currentBounds;
            // Ale stále potřebujeme překreslit markery pro aktuální bounds
            if (lastGeneralSearchResults) {
                displayMultipleItemsOnMap(lastGeneralSearchResults, currentBounds, bufferBounds);
            }
            return;
        }

        // Aktualizujeme lastBoundsString
        lastBoundsString = currentBoundsString;

        // Nastavíme timeout pro zobrazení indikátoru načítání s prodlevou
        loadingIndicatorTimeout = setTimeout(() => {
            showLoadingIndicator();
        }, 300); // Zobrazíme indikátor až po 300 ms

        debounceTimeout = setTimeout(async () => {
            try {
                console.log(`Automatická aktualizace pro bounds: ${currentBoundsString} (buffer: ${bufferBoundsString}) s query: "${query}" a filtry:`, currentActiveFilters);
                await performGenericSearch(query || "", currentBounds, bufferBounds); // Předáme aktuální bounds i buffer bounds

                // Aktualizujeme lastUsedBounds, lastUsedBufferBounds a lastUsedZoom po úspěšném vyhledávání
                lastUsedBounds = currentBounds;
                lastUsedBufferBounds = bufferBounds;
                lastUsedZoom = currentZoom;
            } finally {
                clearTimeout(loadingIndicatorTimeout); // Zrušíme timeout, pokud ještě neproběhl
                hideLoadingIndicator(); // Skryjeme indikátor načítání po dokončení
            }
        }, 1500); // Prodleva 1500 ms (1,5 sekundy)
    }

    function handleMapChange() {
        // Pokud je otevřený panel detailu jedné položky, nebudeme automaticky aktualizovat
        if (infoPanelElement && infoPanelElement.classList.contains('single-item-detail-open')) {
            console.log('Panel detailu položky je otevřený, přeskakuji automatickou aktualizaci.');
            return;
        }

        debouncedPerformSearch();
    }

    // Přidáme listenery na události mapy pro automatickou aktualizaci
    mapInstance.on('moveend zoomend', handleMapChange);

    try {
        const categories = await searchAPI.fetchUniqueCategories();
        renderCategoryFilters(categories);
    } catch (error) {
        console.error("Nepodařilo se načíst kategorie pro rychlé filtry:", error);
        if (categoryFilterBarContainer) {
            categoryFilterBarContainer.innerHTML = `<p style="color: red; font-size: 12px; text-align: center;">Nepodařilo se načíst filtry kategorií.</p>`;
        }
    }

    try {
        const currentBounds = mapInstance.getBounds();
        const currentZoom = mapInstance.getZoom();

        const initialResults = await searchAPI.search("", { bounds: currentBounds, filters: currentActiveFilters });
        isCategorySearch = false;
        renderGeneralSearchResults("Všechny položky", initialResults, true);

        // Inicializujeme lastUsedBounds a lastUsedZoom po prvním načtení dat
        lastUsedBounds = currentBounds;
        lastUsedZoom = currentZoom;
        lastBoundsString = currentBounds.toBBoxString();
    } catch (error) {
        console.error("Chyba při načítání počátečních dat:", error);
        renderGeneralSearchResults("Všechny položky", { error: `Chyba: ${error.message}` }, true);
    }

    console.log('Vyhledávání KOMAPKA inicializováno.');
    hidePanelCompletely();
    updateToggleButtonIcon();
}

/**
 * Callback pro tlačítko filtru. Zobrazí/skryje panel filtrů.
 * Funkce toggleFilterPanelVisibility se nyní stará o skrytí/zobrazení rychlých filtrů kategorií.
 */
function handleFilterButtonClick() {
    console.log("Filter button clicked");

    // Získáme referenci na tlačítko filtru
    const filterButton = document.querySelector('.filter-button-new');

    // Přepneme viditelnost panelu a získáme aktuální stav (true = viditelný, false = skrytý)
    // Funkce toggleFilterPanelVisibility nyní také skrývá/zobrazuje rychlé filtry kategorií
    const isPanelVisible = toggleFilterPanelVisibility();

    // Aktualizujeme stav tlačítka na základě viditelnosti panelu
    if (filterButton) {
        if (isPanelVisible) {
            filterButton.classList.add('active'); // Přidáme třídu active
        } else {
            filterButton.classList.remove('active'); // Odebereme třídu active
        }
    }
}

/**
 * Callback po aplikaci filtrů z panelu.
 * @param {Object} appliedFilters - Objekt s aplikovanými filtry.
 */
function handleApplyFilters(appliedFilters) {
    console.log("Aplikované filtry:", appliedFilters);

    // Transformace filtrů do formátu, který očekává searchAPI
    const transformedFilters = {};

    // Zpracování typu akce (kategorie)
    if (appliedFilters.filter_typAkce && appliedFilters.filter_typAkce.length > 0) {
        transformedFilters.categories = appliedFilters.filter_typAkce;
    }

    // Zpracování lokality
    if (appliedFilters.filter_lokalita_text) {
        transformedFilters.location = appliedFilters.filter_lokalita_text;
    }

    // Zpracování datumů
    if (appliedFilters.filter_datum_od) {
        transformedFilters.dateFrom = appliedFilters.filter_datum_od;
    }
    if (appliedFilters.filter_datum_do) {
        transformedFilters.dateTo = appliedFilters.filter_datum_do;
    }

    // Zpracování vhodnosti pro
    if (appliedFilters.filter_vhodnostPro && appliedFilters.filter_vhodnostPro.length > 0) {
        transformedFilters.suitability = appliedFilters.filter_vhodnostPro;
    }

    // Zpracování cenového rozpětí
    if (appliedFilters.filter_cena && appliedFilters.filter_cena !== 'all') {
        // Hodnota z formuláře jde přímo do transformedFilters.priceRange
        // Mapování hodnot se provádí v searchService.js
        transformedFilters.priceRange = appliedFilters.filter_cena;
        console.log(`Aplikován filtr cenového rozpětí: ${appliedFilters.filter_cena}`);
    }

    // Zpracování prostředí (indoor/outdoor)
    if (appliedFilters.filter_prostredi && appliedFilters.filter_prostredi !== 'all') {
        // Hodnota z formuláře jde přímo do transformedFilters.environment
        // Mapování hodnot se provádí v searchService.js
        transformedFilters.environment = appliedFilters.filter_prostredi;
        console.log(`Aplikován filtr prostředí: ${appliedFilters.filter_prostredi}`);
    }

    // Zpracování zaměření (téma)
    if (appliedFilters.filter_zamereni && appliedFilters.filter_zamereni.length > 0) {
        transformedFilters.focus = appliedFilters.filter_zamereni;
    }

    // Zpracování formátu akce
    if (appliedFilters.filter_format && appliedFilters.filter_format.length > 0) {
        transformedFilters.format = appliedFilters.filter_format;
    }

    // Zpracování jazyka akce
    if (appliedFilters.filter_jazyk && appliedFilters.filter_jazyk.length > 0) {
        transformedFilters.language = appliedFilters.filter_jazyk;
    }

    // Zpracování rezervace a vstupného
    if (appliedFilters.filter_rezervace && appliedFilters.filter_rezervace.length > 0) {
        transformedFilters.reservation = appliedFilters.filter_rezervace;
    }

    // Zpracování denní doby
    if (appliedFilters.filter_denniDoba && appliedFilters.filter_denniDoba.length > 0) {
        transformedFilters.timeOfDay = appliedFilters.filter_denniDoba;
    }

    // Aktualizace globální proměnné s aktivními filtry
    currentActiveFilters = transformedFilters;

    // Skrytí panelu filtrů po aplikaci
    toggleFilterPanelVisibility(false);

    // Aktualizace stavu tlačítka filtrů
    const filterButton = document.querySelector('.filter-button-new');
    if (filterButton) {
        // Pokud jsou nějaké filtry aktivní, zvýrazníme tlačítko
        const hasActiveFilters = Object.keys(currentActiveFilters).length > 0;
        filterButton.classList.toggle('has-active-filters', hasActiveFilters);
    }

    isCategorySearch = false; // Detailní filtry mají přednost před rychlým filtrem kategorie

    // Získáme aktuální text z vyhledávacího pole
    const searchInput = document.querySelector('.search-input'); // Předpokládáme, že existuje jen jeden
    const currentQueryText = searchInput ? searchInput.value.trim() : "";

    // Pokud je aktivní filtr kategorie z rychlých filtrů, deaktivujeme ho
    if (categoryFilterBarContainer) {
        categoryFilterBarContainer.querySelectorAll('.category-filter-button.active').forEach(btn => {
            btn.classList.remove('active');
            const clearIcon = btn.querySelector('.clear-filter-icon');
            if (clearIcon) clearIcon.remove();
        });
    }

    console.log("Aplikace filtrů - aktuální query:", currentQueryText);
    console.log("Aplikace filtrů - transformované filtry:", transformedFilters);

    // Pokud po aplikaci detailních filtrů je vyhledávací pole prázdné,
    // a nejsou žádné filtry, vyhledáme vše v oblasti.
    // Pokud jsou filtry, vyhledáme podle nich i s prázdným query.
    if (currentQueryText === "" && Object.keys(currentActiveFilters).length === 0) {
        console.log("Vyhledávání všech položek v oblasti (žádné filtry)");
        performGenericSearch(""); // Načte vše v oblasti
    } else {
        console.log("Vyhledávání s filtry nebo textem:", currentQueryText);
        performGenericSearch(currentQueryText); // Vyhledá s textem (může být prázdný) a filtry
    }
}


// --- Funkce pro ovládání stavu info panelu (togglePanelState, openInfoPanel, minimizeInfoPanel, hidePanelCompletely, updateToggleButtonIcon) ---
function togglePanelState() {
    if (!infoPanelElement) return;

    if (infoPanelElement.classList.contains('open')) {
        minimizeInfoPanel();
    } else if (infoPanelElement.classList.contains('minimized')) {
        openInfoPanel();
    } else {
        // Panel je skrytý, otevřeme ho
        openInfoPanel();
    }
}

function openInfoPanel() {
    if (!infoPanelElement || !infoContentElement) return;

    if (!infoPanelElement.classList.contains('open') || infoPanelElement.classList.contains('minimized')) {
        const wasMinimized = infoPanelElement.classList.contains('minimized');
        infoPanelElement.classList.remove('minimized');

        const handleTransitionEnd = (event) => {
            if (event.propertyName === 'transform' && infoPanelElement.classList.contains('open')) {
                if (mapInstance) mapInstance.invalidateSize({animate: true});
                infoPanelElement.removeEventListener('transitionend', handleTransitionEnd);
            }
        };
        infoPanelElement.addEventListener('transitionend', handleTransitionEnd);

        infoPanelElement.classList.add('open');
        if (mapOverlayBgElement) mapOverlayBgElement.classList.add('visible');
        updateToggleButtonIcon();

        if (!wasMinimized && getComputedStyle(infoPanelElement).transitionDuration === '0s') {
             if (mapInstance) setTimeout(() => mapInstance.invalidateSize({animate: true}), 50);
        }
    } else {
        if (mapInstance) setTimeout(() => mapInstance.invalidateSize({animate: true}), 50);
    }
}

function minimizeInfoPanel() {
    if (!infoPanelElement) return;

    console.log("Minimalizuji panel...");

    // Můžeme minimalizovat z otevřeného stavu nebo ze skrytého stavu
    infoPanelElement.classList.remove('open');
    infoPanelElement.classList.add('minimized');

    if (mapOverlayBgElement) mapOverlayBgElement.classList.remove('visible');
    updateToggleButtonIcon();

    // Kontrola viditelnosti tlačítka
    if (toggleInfoPanelButton) {
        console.log("Tlačítko pro přepínání panelu:", toggleInfoPanelButton);
        // Zajistíme, že tlačítko je viditelné
        toggleInfoPanelButton.style.display = 'flex';
        toggleInfoPanelButton.style.visibility = 'visible';
    }

    const handleTransitionEnd = (event) => {
        if (event.propertyName === 'transform' && infoPanelElement.classList.contains('minimized')) {
            if (mapInstance) mapInstance.invalidateSize({animate: true});
            infoPanelElement.removeEventListener('transitionend', handleTransitionEnd);

            // Kontrola viditelnosti tlačítka po dokončení animace
            if (toggleInfoPanelButton) {
                console.log("Tlačítko po animaci:", toggleInfoPanelButton);
                toggleInfoPanelButton.style.display = 'flex';
                toggleInfoPanelButton.style.visibility = 'visible';
            }
        }
    };
    infoPanelElement.addEventListener('transitionend', handleTransitionEnd);
    if (getComputedStyle(infoPanelElement).transitionDuration === '0s') {
        if (mapInstance) setTimeout(() => mapInstance.invalidateSize({animate: true}), 50);
    }
}

function hidePanelCompletely() {
    if (!infoPanelElement) return;
    infoPanelElement.classList.remove('open');
    infoPanelElement.classList.remove('minimized');
    infoPanelElement.classList.remove('single-item-detail-open'); // Odstraníme třídu pro detail položky
    if (mapOverlayBgElement) mapOverlayBgElement.classList.remove('visible');
    updateToggleButtonIcon();
    // Zrušíme zvýraznění markeru při zavření panelu
    unhighlightAllMarkers();
    if (mapInstance) setTimeout(() => mapInstance.invalidateSize({animate: true}), 350); // Delší timeout pro jistotu
}

function updateToggleButtonIcon() {
    if (!toggleInfoPanelButton) return;
    const icon = toggleInfoPanelButton.querySelector('i');
    if (!icon) return;

    // Aktualizace ikony podle stavu panelu
    if (infoPanelElement.classList.contains('open')) {
        icon.className = 'fas fa-chevron-left';
        toggleInfoPanelButton.title = "Minimalizovat panel";
    } else {
        icon.className = 'fas fa-chevron-right';
        toggleInfoPanelButton.title = "Otevřít panel";
    }
}
// Konec funkcí pro info panel

function renderCategoryFilters(categories) {
    // ... (původní kód renderCategoryFilters) ...
    // Tato funkce zůstává, protože rychlé filtry kategorií chceme stále zachovat.
    // Pokud uživatel použije detailní filtr, rychlý filtr kategorie se deaktivuje.
    if (!categoryFilterBarContainer || !categories || categories.length === 0) {
        if (categoryFilterBarContainer) categoryFilterBarContainer.style.display = 'none';
        return;
    }
    categoryFilterBarContainer.style.display = 'block';

    const filterBar = document.createElement('div');
    filterBar.className = 'category-filters-bar';
    filterBar.style.overflowX = 'hidden';

    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-filter-button';
        button.setAttribute('data-category', category);

        const textSpan = document.createElement('span');
        textSpan.textContent = category;
        button.appendChild(textSpan);

        button.addEventListener('click', (event) => {
            if (event.target.classList.contains('clear-filter-icon')) {
                return;
            }
            const isActive = button.classList.contains('active');
            filterBar.querySelectorAll('.category-filter-button.active').forEach(btn => {
                btn.classList.remove('active');
                const existingIcon = btn.querySelector('.clear-filter-icon');
                if (existingIcon) {
                    existingIcon.remove();
                }
            });

            if (!isActive) {
                button.classList.add('active');
                console.log(`Rychlý filtr kategorie: ${category}`);
                isCategorySearch = true;
                currentActiveFilters = {}; // Deaktivujeme detailní filtry, pokud se použije rychlý

                // Skryjeme panel detailních filtrů a aktualizujeme stav tlačítka
                const isPanelVisible = toggleFilterPanelVisibility(false);
                const filterButton = document.querySelector('.filter-button-new');
                if (filterButton) {
                    filterButton.classList.toggle('active', isPanelVisible);
                }

                performGenericSearch(category); // Hledáme POUZE podle této kategorie

                const clearIcon = document.createElement('i');
                clearIcon.className = 'fas fa-times-circle clear-filter-icon';
                clearIcon.title = 'Zrušit filtr';
                clearIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    isCategorySearch = false;
                    button.classList.remove('active');
                    const iconToRemove = button.querySelector('.clear-filter-icon');
                    if(iconToRemove) iconToRemove.remove();
                    clearAllResults(); // Vyčistí i query a provede obecné hledání
                });
                button.appendChild(clearIcon);
            } else {
                console.log(`Zrušení rychlého filtru kategorie: ${category}`);
                isCategorySearch = false;
                clearAllResults();
            }
            if (typeof hideSuggestions === "function") hideSuggestions();
        });
        filterBar.appendChild(button);
    });
    categoryFilterBarContainer.innerHTML = '';
    categoryFilterBarContainer.appendChild(filterBar);
}

function handleSearchCallback(queryText, suggestionData) {
    // Pokud je aktivní rychlý filtr kategorie, deaktivujeme ho, protože hledáme textem nebo vybíráme návrh
    if (categoryFilterBarContainer) {
        categoryFilterBarContainer.querySelectorAll('.category-filter-button.active').forEach(btn => {
            btn.classList.remove('active');
            const clearIcon = btn.querySelector('.clear-filter-icon');
            if (clearIcon) clearIcon.remove();
        });
    }
    isCategorySearch = false; // Vyhledávání textem/návrhem ruší příznak kategorie

    // Detailní filtry (currentActiveFilters) zůstávají aktivní!

    lastGeneralSearchQuery = queryText;
    if (suggestionData && suggestionData.item && suggestionData.type) {
        // Zobrazení konkrétní položky z návrhu
        displaySingleItemOnMapAndInPanel(suggestionData.item, suggestionData.type, false);
        lastGeneralSearchResults = null; // Vymažeme poslední výsledky obecného hledání
        if (typeof suggestionData.item.latitude !== 'undefined' && typeof suggestionData.item.longitude !== 'undefined') {
            mapInstance.flyTo([suggestionData.item.latitude, suggestionData.item.longitude], 16, { animate: true, duration: 0.7 });
        }
    } else {
        // Obecné textové vyhledávání
        console.log(`Obecné vyhledávání pro: "${queryText}" s aktivními filtry:`, currentActiveFilters);
        performGenericSearch(queryText);
    }
}

async function performGenericSearch(query, currentBounds = null, bufferBounds = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const queryToSearch = query ? query.trim() : ""; // query může být prázdné

            // Pokud nejsou předány bounds, použijeme aktuální bounds mapy
            if (!currentBounds) {
                currentBounds = mapInstance.getBounds();
            }

            // Pokud nejsou předány buffer bounds, použijeme stejné jako currentBounds
            if (!bufferBounds) {
                bufferBounds = currentBounds;
            }

            // Pokud je aktivní rychlý filtr kategorie (isCategorySearch === true),
            // pak query je název té kategorie a currentActiveFilters by měly být prázdné.
            // Pokud je isCategorySearch false, hledáme podle queryToSearch a currentActiveFilters.

            // Zvláštní případ: prázdný dotaz a žádné aktivní filtry -> načti vše v oblasti
            if (queryToSearch === "" && Object.keys(currentActiveFilters).length === 0 && !isCategorySearch) {
                try {
                    const allResultsInView = await searchAPI.search("", {
                        bounds: bufferBounds, // Použijeme buffer bounds pro vyhledávání
                        filters: {} // Prázdné filtry explicitně
                    });
                    renderGeneralSearchResults("Všechny položky", allResultsInView, true, currentBounds, bufferBounds);
                    resolve();
                    return;
                } catch (error) {
                    console.error("Chyba při načítání všech položek:", error);
                    renderGeneralSearchResults("Všechny položky", { error: `Chyba: ${error.message}` }, true);
                    reject(error);
                    return;
                }
            }

            // Geokódování pro známá města (zůstává)
            if (!isCategorySearch && queryToSearch.length > 2 && (queryToSearch.toLowerCase().includes("praha") || queryToSearch.toLowerCase().includes("brno"))) {
                try {
                    const geocodeResult = await searchAPI.geocodeLocation(queryToSearch);
                    if (geocodeResult && geocodeResult.bounds) {
                        console.log(`Geokódovaná lokalita: ${queryToSearch}`, geocodeResult);
                        mapInstance.fitBounds(geocodeResult.bounds);

                        // Aktualizujeme bounds po fitBounds
                        currentBounds = mapInstance.getBounds();
                        bufferBounds = calculateBufferBounds(currentBounds, 0.5);

                        // Po geokódování chceme vyhledat v nových bounds s aktuálními filtry (a prázdným textovým dotazem, pokud geokódování bylo úspěšné)
                        const resultsInBounds = await searchAPI.search("", { // Prázdný textový dotaz
                            bounds: bufferBounds, // Použijeme buffer bounds pro vyhledávání
                            filters: currentActiveFilters
                        });
                        renderGeneralSearchResults(queryToSearch, resultsInBounds, true, currentBounds, bufferBounds); // Zobrazíme s původním query pro titulek
                        resolve();
                        return;
                    }
                } catch (geoError) {
                    console.warn(`Geokódování pro "${queryToSearch}" selhalo:`, geoError);
                    // Pokračujeme standardním vyhledáváním
                }
            }

            // Standardní vyhledávání
            try {
                const searchOptions = {
                    bounds: bufferBounds, // Použijeme buffer bounds pro vyhledávání
                    filters: currentActiveFilters // Přidáme aktuální filtry
                };
                // Pokud je aktivní rychlý filtr kategorie, query je název kategorie
                const actualQueryForAPI = isCategorySearch ? query : queryToSearch;

                console.log(`Volání searchAPI.search s query: "${actualQueryForAPI}", isCategorySearch: ${isCategorySearch}, filtry:`, currentActiveFilters);
                console.log(`Vyhledávání v buffer bounds: ${bufferBounds.toBBoxString()}, aktuální bounds: ${currentBounds.toBBoxString()}`);

                const results = await searchAPI.search(actualQueryForAPI, searchOptions);
                renderGeneralSearchResults(query, results, false, currentBounds, bufferBounds); // query pro titulek je původní text nebo kategorie
                resolve();
            } catch (error) {
                console.error(`Chyba při obecném vyhledávání pro "${query}":`, error);
                renderGeneralSearchResults(query, { error: `Chyba: ${error.message}` });
                reject(error);
            }
        } catch (error) {
            console.error("Neočekávaná chyba v performGenericSearch:", error);
            reject(error);
        }
    });
}

// Funkce renderGeneralSearchResults, displaySingleItemOnMapAndInPanel, displayMultipleItemsOnMap,
// createAndAddMarkerToMap, findMarkerByItemData, highlightMarker, unhighlightAllMarkers, clearMapMarkers
// zůstávají víceméně stejné. Jen renderGeneralSearchResults potřebuje správně předávat
// příznak `pouzeAktivityVPanelu` na základě `isCategorySearch`.

function renderGeneralSearchResults(originalQuery, resultsData, isFromGeocodingOrInitial = false, currentBounds = null, bufferBounds = null) {
    lastGeneralSearchResults = resultsData;

    // Odstraníme třídu pro označení, že je zobrazen detail položky
    if (infoPanelElement) {
        infoPanelElement.classList.remove('single-item-detail-open');
    }

    // Při změně dotazu nebo filtrů vyčistíme všechny markery
    // Při automatické aktualizaci (isFromGeocodingOrInitial === true) použijeme inkrementální aktualizaci
    if (!isFromGeocodingOrInitial) {
        clearMapMarkers();
    }

    // Pokud nejsou předány bounds, použijeme aktuální bounds mapy
    if (!currentBounds) {
        currentBounds = mapInstance.getBounds();
    }

    // Pokud nejsou předány buffer bounds, použijeme stejné jako currentBounds
    if (!bufferBounds) {
        bufferBounds = currentBounds;
    }

    // Zjistíme, zda máme nový formát výsledků (s mapBounds a total)
    const isNewResultFormat = resultsData.mapBounds && resultsData.total;

    // Počet položek pro zobrazení na mapě
    let mapItemsCount = 0;

    // Počet všech položek odpovídajících filtrům (i mimo bounds)
    let totalItemsCount = 0;

    if (isNewResultFormat) {
        // Nový formát - máme informace o počtu položek v bounds a celkem
        mapItemsCount = resultsData.mapBounds.total;
        totalItemsCount = resultsData.total.total;

        // Logujeme informace o počtu položek
        console.log(`Pro "${originalQuery}" nalezeno celkem ${totalItemsCount} položek, z toho ${mapItemsCount} v aktuálním výřezu mapy.`);
    } else {
        // Starý formát - počítáme položky přímo z polí
        mapItemsCount = totalItemsCount = (resultsData.activities?.length || 0) +
                                          (resultsData.places?.length || 0) +
                                          (resultsData.communities?.length || 0);

        console.log(`Pro "${originalQuery}" nalezeno ${totalItemsCount} položek.`);
    }

    if (totalItemsCount === 0) {
        console.log(`Pro "${originalQuery}" nebyly nalezeny žádné výsledky (žádný typ).`);
        if (infoContentElement) {
            // Zpráva by měla zohlednit, zda byly aktivní filtry a zdroj výsledků
            const filterText = Object.keys(currentActiveFilters).length > 0 || isCategorySearch ? " s aktivními filtry" : "";
            infoContentElement.innerHTML = `<p class="komapka-error-message">Chyba při vyhledávání${sourceInfo}: ${resultsData.error}</p>`;
            openInfoPanel();
        }
        return;
    }

    // Zobrazíme markery na mapě s rozlišením mezi aktuálními bounds a buffer bounds
    displayMultipleItemsOnMap(resultsData, currentBounds, bufferBounds);

    // Připravíme data pro panel
    let dataProPanel;
    // Příznak `pouzeAktivityVPanelu` se nyní řídí JEN `isCategorySearch` (rychlé filtry kategorií)
    // Detailní filtry mohou filtrovat napříč typy, takže panel by měl zobrazit všechny typy.
    const pouzeAktivityVPaneluProPanel = isCategorySearch;

    if (pouzeAktivityVPaneluProPanel) {
        dataProPanel = {
            activities: resultsData.activities || [],
            places: [], // Pro rychlý filtr kategorie zobrazujeme jen aktivity v panelu
            communities: []
        };
    } else {
        dataProPanel = resultsData; // Pro obecné hledání nebo detailní filtry zobrazujeme vše
    }

    const maPanelAktivity = dataProPanel.activities && dataProPanel.activities.length > 0;
    const maPanelMista = !pouzeAktivityVPaneluProPanel && dataProPanel.places && dataProPanel.places.length > 0;
    const maPanelKomunity = !pouzeAktivityVPaneluProPanel && dataProPanel.communities && dataProPanel.communities.length > 0;

    if (infoContentElement && typeof displaySearchResults === 'function') {
        // Pokud máme nový formát a celkový počet položek je větší než počet položek v bounds,
        // přidáme informaci o tom, že některé položky nejsou viditelné na mapě
        let boundsInfo = "";
        if (isNewResultFormat && totalItemsCount > mapItemsCount) {
            const outsideBoundsCount = totalItemsCount - mapItemsCount;
            boundsInfo = `<p class="search-results-bounds-info">Nalezeno celkem ${totalItemsCount} položek, z toho ${outsideBoundsCount} mimo aktuální výřez mapy.</p>`;
        }

        if (pouzeAktivityVPaneluProPanel && !maPanelAktivity) {
            infoContentElement.innerHTML = `<p>Pro kategorii "${originalQuery}"${sourceInfo} nebyly nalezeny žádné aktivity.</p>${boundsInfo}`;
        } else if (!maPanelAktivity && !maPanelMista && !maPanelKomunity) {
            const filterText = Object.keys(currentActiveFilters).length > 0 ? " s aktivními filtry" : "";
            infoContentElement.innerHTML = `<p>Pro dotaz "${originalQuery}"${filterText}${sourceInfo} nebyly v panelu nalezeny žádné položky k zobrazení.</p>${boundsInfo}`;
        } else {
            // Přidáme informaci o počtu položek mimo bounds před zobrazením výsledků
            if (boundsInfo) {
                const boundsInfoElement = document.createElement('div');
                boundsInfoElement.className = 'search-results-bounds-info-container';
                boundsInfoElement.innerHTML = boundsInfo;
                infoContentElement.appendChild(boundsInfoElement);
            }

            let initialTab = 'activities';
            if (pouzeAktivityVPaneluProPanel) {
                initialTab = 'activities';
            } else {
                if (maPanelAktivity) initialTab = 'activities';
                else if (maPanelMista) initialTab = 'places';
                else if (maPanelKomunity) initialTab = 'communities';
            }

            displaySearchResults(
                originalQuery,
                dataProPanel,
                infoContentElement,
                (itemFromList, itemTypeFromList) => {
                    displaySingleItemOnMapAndInPanel(itemFromList, itemTypeFromList, true);
                },
                initialTab,
                pouzeAktivityVPaneluProPanel // Předáváme správný příznak
            );
        }
        openInfoPanel();
    } else {
        if (!infoContentElement) console.warn("Info panel content element (#info-content) nebyl nalezen.");
        if (typeof displaySearchResults !== 'function') console.warn("Funkce 'displaySearchResults' není importována.");
    }

    // Již nezobrazujeme tlačítko "Vyhledat v této oblasti", protože data se aktualizují automaticky
}


function displaySingleItemOnMapAndInPanel(itemData, itemType, keepOtherMarkersOnMap = false) {
    if (!itemData) {
        console.warn("Pokus o zobrazení null itemu.");
        return;
    }

    // Při zobrazení detailu položky vždy zrušíme aktuální výběr
    unhighlightAllMarkers();

    // Pokud nechceme zachovat ostatní markery, vyčistíme je
    if (!keepOtherMarkersOnMap) {
        clearMapMarkers();
    }

    // Přidáme třídu pro označení, že je zobrazen detail položky
    if (infoPanelElement) {
        infoPanelElement.classList.add('single-item-detail-open');
    }

    if (itemType === 'activity') displayActivityDetailsInPanel(itemData);
    else if (itemType === 'place') displayPlaceDetailsInPanel(itemData);
    else if (itemType === 'community') displayCommunityDetailsInPanel(itemData);
    else console.warn(`Neznámý typ položky pro zobrazení detailů: ${itemType}`);
    openInfoPanel();

    if (typeof itemData.latitude !== 'undefined' && typeof itemData.longitude !== 'undefined') {
        const existingMarker = findMarkerByItemData(itemData, itemType);
        let markerToHighlight = existingMarker || createAndAddMarkerToMap(itemData, itemType, false);

        if (markerToHighlight) {
            highlightMarker(markerToHighlight);
            currentlySelectedMarker = markerToHighlight;

            if (markersLayerGroup.zoomToShowLayer && typeof markersLayerGroup.zoomToShowLayer === 'function') {
                markersLayerGroup.zoomToShowLayer(markerToHighlight, () => {});
            }
        }
    } else {
        console.warn("Položka nemá souřadnice pro zobrazení na mapě:", itemData);
    }
}

/**
 * Vytvoří placeholder marker pro položku, která je mimo aktuální bounds, ale v buffer bounds
 * @param {Object} itemData - Data položky
 * @param {string} itemType - Typ položky ('activity', 'place', 'community')
 * @returns {L.CircleMarker} - Vytvořený placeholder marker
 */
function createPlaceholderMarker(itemData, itemType) {
    if (!itemData || typeof itemData.latitude !== 'number' || typeof itemData.longitude !== 'number') {
        console.warn("Neplatná data nebo chybějící souřadnice pro placeholder marker:", itemData);
        return null;
    }

    // Barva podle typu položky
    let color = 'gray';
    if (itemType === 'activity') color = '#aaaaaa';
    else if (itemType === 'place') color = '#888888';
    else if (itemType === 'community') color = '#666666';

    const marker = L.circleMarker([itemData.latitude, itemData.longitude], {
        radius: 3,
        color: color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 1,
        opacity: 0.7,
        zIndexOffset: -1000 // Nižší zIndex než normální markery
    });

    marker.komapkaItemData = itemData;
    marker.komapkaItemType = itemType;
    marker.isPlaceholder = true; // Příznak, že se jedná o placeholder

    const popupContent = `<b>${itemData.nazev || 'Neznámý název'}</b><br>${itemData.adresa || 'Adresa neuvedena'}<br><i>Mimo aktuální výřez mapy</i>`;
    marker.bindPopup(popupContent);

    // Příznak, zda byl marker aktivován kliknutím
    marker.isActivated = false;

    // Přidáme událost mouseover pro zobrazení popup při najetí myší
    marker.on('mouseover', function() {
        // Otevřeme popup pouze pokud není marker aktivován
        if (!this.isActivated) {
            this.openPopup();
        }
    });

    // Přidáme událost mouseout pro skrytí popup při odjetí myší
    marker.on('mouseout', function() {
        // Zavřeme popup pouze pokud není marker aktivován
        if (!this.isActivated) {
            this.closePopup();
        }
    });

    marker.on('click', function() {
        // Nastavíme příznak aktivace
        this.isActivated = true;
        // Otevřeme popup bez probliknutí (pokud už není otevřený)
        if (!this._popup._isOpen) {
            this.openPopup();
        }
        // Při kliknutí na placeholder marker zobrazíme detail položky
        displaySingleItemOnMapAndInPanel(this.komapkaItemData, this.komapkaItemType, true);
    });

    markersLayerGroup.addLayer(marker);
    return marker;
}

/**
 * Zobrazí položky na mapě s rozlišením mezi aktuálními bounds a buffer bounds
 * @param {Object} resultsData - Data výsledků vyhledávání
 * @param {L.LatLngBounds} currentBounds - Aktuální hranice mapy
 * @param {L.LatLngBounds} bufferBounds - Rozšířené hranice pro nárazníkovou zónu
 */
function displayMultipleItemsOnMap(resultsData, currentBounds = null, bufferBounds = null) {
    // Pokud nejsou předány bounds, použijeme aktuální bounds mapy
    if (!currentBounds) {
        currentBounds = mapInstance.getBounds();
    }

    // Pokud nejsou předány buffer bounds, použijeme stejné jako currentBounds
    if (!bufferBounds) {
        bufferBounds = currentBounds;
    }

    // Zjistíme, zda máme nový formát výsledků (s mapBounds a total)
    const isNewResultFormat = resultsData.mapBounds && resultsData.total;

    // Vytvoříme mapu existujících markerů pro rychlé vyhledávání
    const existingMarkers = new Map();
    markersLayerGroup.eachLayer(marker => {
        if (marker.komapkaItemData && marker.komapkaItemType) {
            const itemId = marker.komapkaItemData.id ||
                (marker.komapkaItemData.nazev + String(marker.komapkaItemData.latitude) + String(marker.komapkaItemData.longitude));
            if (itemId) {
                existingMarkers.set(`${marker.komapkaItemType}_${itemId}`, marker);
            }
        }
    });

    // Vytvoříme set pro sledování markerů, které chceme zachovat
    const markersToKeep = new Set();

    // Počítadla pro statistiky
    let fullMarkersCount = 0;
    let placeholderMarkersCount = 0;

    const addOrUpdateItems = (items, itemType) => {
        if (!items || items.length === 0) return;

        items.forEach(item => {
            // Vytvoříme ID pro položku
            const itemId = item.id || (item.nazev + String(item.latitude) + String(item.longitude));
            if (!itemId) {
                console.warn("Položka nemá ID ani název/souřadnice pro spolehlivé vytvoření markeru.", item);
                return;
            }

            const markerKey = `${itemType}_${itemId}`;

            // Kontrola, zda je položka v aktuálních bounds nebo buffer bounds
            const itemLatLng = L.latLng(item.latitude, item.longitude);
            const isInCurrentBounds = currentBounds.contains(itemLatLng);
            const isInBufferBounds = !isInCurrentBounds && bufferBounds.contains(itemLatLng);

            // Pokud marker již existuje
            if (existingMarkers.has(markerKey)) {
                const existingMarker = existingMarkers.get(markerKey);

                // Pokud je položka v aktuálních bounds, ale marker je placeholder, nahradíme ho plným markerem
                if (isInCurrentBounds && existingMarker.isPlaceholder) {
                    markersLayerGroup.removeLayer(existingMarker);
                    createAndAddMarkerToMap(item, itemType, false);
                    fullMarkersCount++;
                }
                // Pokud je položka v buffer bounds, ale ne v aktuálních bounds, a marker není placeholder, nahradíme ho placeholderem
                else if (isInBufferBounds && !existingMarker.isPlaceholder) {
                    markersLayerGroup.removeLayer(existingMarker);
                    createPlaceholderMarker(item, itemType);
                    placeholderMarkersCount++;
                }
                // Jinak marker zachováme
                else {
                    if (existingMarker.isPlaceholder) {
                        placeholderMarkersCount++;
                    } else {
                        fullMarkersCount++;
                    }
                }

                markersToKeep.add(markerKey);
            }
            // Pokud marker neexistuje, vytvoříme nový
            else {
                if (isInCurrentBounds) {
                    // Položka je v aktuálních bounds, vytvoříme plný marker
                    createAndAddMarkerToMap(item, itemType, false);
                    fullMarkersCount++;
                } else if (isInBufferBounds) {
                    // Položka je v buffer bounds, ale ne v aktuálních bounds, vytvoříme placeholder
                    createPlaceholderMarker(item, itemType);
                    placeholderMarkersCount++;
                }
                // Jinak položku ignorujeme (není ani v buffer bounds)

                markersToKeep.add(markerKey);
            }
        });
    };

    // Zpracujeme data podle formátu
    if (isNewResultFormat) {
        // Pokud jsou v resultsData.mapBounds.activities, places, communities, použijeme je
        if (resultsData.mapBounds.activities && resultsData.mapBounds.activities.length > 0) {
            addOrUpdateItems(resultsData.mapBounds.activities, 'activity');
        } else {
            // Jinak použijeme data z resultsData.activities
            addOrUpdateItems(resultsData.activities, 'activity');
        }

        if (resultsData.mapBounds.places && resultsData.mapBounds.places.length > 0) {
            addOrUpdateItems(resultsData.mapBounds.places, 'place');
        } else {
            addOrUpdateItems(resultsData.places, 'place');
        }

        if (resultsData.mapBounds.communities && resultsData.mapBounds.communities.length > 0) {
            addOrUpdateItems(resultsData.mapBounds.communities, 'community');
        } else {
            addOrUpdateItems(resultsData.communities, 'community');
        }
    } else {
        // Starý formát - použijeme data přímo z resultsData
        addOrUpdateItems(resultsData.activities, 'activity');
        addOrUpdateItems(resultsData.places, 'place');
        addOrUpdateItems(resultsData.communities, 'community');
    }

    // Odstraníme markery, které již nejsou potřeba
    markersLayerGroup.eachLayer(marker => {
        if (marker.komapkaItemData && marker.komapkaItemType) {
            const itemId = marker.komapkaItemData.id ||
                (marker.komapkaItemData.nazev + String(marker.komapkaItemData.latitude) + String(marker.komapkaItemData.longitude));
            if (itemId) {
                const markerKey = `${marker.komapkaItemType}_${itemId}`;
                if (!markersToKeep.has(markerKey)) {
                    markersLayerGroup.removeLayer(marker);
                }
            }
        }
    });

    console.log(`Inkrementální aktualizace markerů: ${markersToKeep.size} zachováno (${fullMarkersCount} plných, ${placeholderMarkersCount} placeholderů), ${existingMarkers.size - markersToKeep.size} odstraněno, ${markersToKeep.size - existingMarkers.size} přidáno.`);
}

function createAndAddMarkerToMap(itemData, itemType, isInitiallyHighlighted = false) {
    // ... (kód zůstává stejný)
    if (!itemData || typeof itemData.latitude !== 'number' || typeof itemData.longitude !== 'number') {
        console.warn("Neplatná data nebo chybějící souřadnice pro marker:", itemData);
        return null;
    }

    let iconOptions;
    if (itemType === 'activity') {
        iconOptions = isInitiallyHighlighted ? highlightedActivityIcon : defaultActivityIcon;
    } else if (itemType === 'place') {
        iconOptions = isInitiallyHighlighted ? highlightedPlaceIcon : defaultPlaceIcon;
    } else if (itemType === 'community') { // Pro komunity můžeme použít např. defaultní ikonku aktivity nebo vlastní
        iconOptions = defaultActivityIcon;
    } else {
        console.warn("Neznámý typ položky pro ikonu:", itemType, "používám defaultní.");
        iconOptions = defaultActivityIcon;
    }

    const marker = L.marker([itemData.latitude, itemData.longitude], {
        icon: iconOptions,
        opacity: isInitiallyHighlighted ? HIGHLIGHTED_MARKER_OPACITY : DEFAULT_MARKER_OPACITY,
        zIndexOffset: isInitiallyHighlighted ? HIGHLIGHTED_ZINDEX : DEFAULT_ZINDEX
    });

    marker.komapkaItemData = itemData;
    marker.komapkaItemType = itemType;

    const popupContent = `<b>${itemData.nazev || 'Neznámý název'}</b><br>${itemData.adresa || 'Adresa neuvedena'}`;
    marker.bindPopup(popupContent);

    // Příznak, zda byl marker aktivován kliknutím
    marker.isActivated = false;

    // Přidáme událost mouseover pro zobrazení popup při najetí myší
    marker.on('mouseover', function() {
        // Otevřeme popup pouze pokud není marker aktivován
        if (!this.isActivated) {
            this.openPopup();
        }
    });

    // Přidáme událost mouseout pro skrytí popup při odjetí myší
    marker.on('mouseout', function() {
        // Zavřeme popup pouze pokud není marker aktivován
        if (!this.isActivated) {
            this.closePopup();
        }
    });

    marker.on('click', function() {
        // Nastavíme příznak aktivace
        this.isActivated = true;
        // Otevřeme popup bez probliknutí (pokud už není otevřený)
        if (!this._popup._isOpen) {
            this.openPopup();
        }
        displaySingleItemOnMapAndInPanel(this.komapkaItemData, this.komapkaItemType, true);
    });

    markersLayerGroup.addLayer(marker);
    return marker;
}

function findMarkerByItemData(itemDataToFind, itemTypeToFind) {
    // ... (kód zůstává stejný)
    let foundMarker = null;
    // Použijeme kombinaci ID (pokud existuje) a názvu/souřadnic pro robustnější porovnání
    const itemIdToFind = itemDataToFind.id || (itemDataToFind.nazev + String(itemDataToFind.latitude) + String(itemDataToFind.longitude));
    if (!itemIdToFind) { // Pokud stále nemáme ID, logujeme varování
        console.warn("Položka nemá ID ani název/souřadnice pro spolehlivé nalezení markeru.", itemDataToFind);
        // Můžeme zkusit porovnat přímo objekty, ale to je nespolehlivé, pokud objekty nejsou identické
    }
    markersLayerGroup.eachLayer(marker => {
        if (marker.komapkaItemData) {
            const currentMarkerId = marker.komapkaItemData.id || (marker.komapkaItemData.nazev + String(marker.komapkaItemData.latitude) + String(marker.komapkaItemData.longitude));
            if (itemIdToFind && currentMarkerId === itemIdToFind && marker.komapkaItemType === itemTypeToFind) {
                foundMarker = marker;
            } else if (!itemIdToFind && marker.komapkaItemData === itemDataToFind && marker.komapkaItemType === itemTypeToFind) {
                // Fallback pro porovnání objektů, pokud ID chybí (méně spolehlivé)
                foundMarker = marker;
            }
        }
    });
    return foundMarker;
}

function highlightMarker(markerToHighlight) {
    // ... (kód zůstává stejný)
    if (!markerToHighlight) return;
    let icon;
    if (markerToHighlight.komapkaItemType === 'activity') icon = highlightedActivityIcon;
    else if (markerToHighlight.komapkaItemType === 'place') icon = highlightedPlaceIcon;
    else icon = highlightedActivityIcon; // Fallback na aktivitu

    markerToHighlight.setIcon(icon);
    markerToHighlight.setOpacity(HIGHLIGHTED_MARKER_OPACITY);
    if (markerToHighlight.setZIndexOffset) markerToHighlight.setZIndexOffset(HIGHLIGHTED_ZINDEX);
}

function unhighlightAllMarkers() {
    // ... (kód zůstává stejný)
    if (currentlySelectedMarker) {
        let icon;
        if (currentlySelectedMarker.komapkaItemType === 'activity') icon = defaultActivityIcon;
        else if (currentlySelectedMarker.komapkaItemType === 'place') icon = defaultPlaceIcon;
        else icon = defaultActivityIcon; // Fallback

        currentlySelectedMarker.setIcon(icon);
        currentlySelectedMarker.setOpacity(DEFAULT_MARKER_OPACITY);
        if (currentlySelectedMarker.setZIndexOffset) currentlySelectedMarker.setZIndexOffset(DEFAULT_ZINDEX);

        // Resetujeme příznak aktivace a zavřeme popup
        if (currentlySelectedMarker.isActivated) {
            currentlySelectedMarker.isActivated = false;
            currentlySelectedMarker.closePopup();
        }
    }
    currentlySelectedMarker = null;
}

function clearMapMarkers() {
    // ... (kód zůstává stejný)
    markersLayerGroup.clearLayers();
    currentlySelectedMarker = null;
}

function clearAllResults() {
    isCategorySearch = false;
    currentActiveFilters = {}; // Vyčistíme i detailní filtry

    // Skryjeme panel detailních filtrů a aktualizujeme stav tlačítka
    const isPanelVisible = toggleFilterPanelVisibility(false);
    const filterButton = document.querySelector('.filter-button-new');
    if (filterButton) {
        filterButton.classList.toggle('active', isPanelVisible);
    }

    // Vyčistíme text ve vyhledávacím poli
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = "";
    lastGeneralSearchQuery = ""; // Resetujeme i query

    // Deaktivujeme rychlé filtry kategorií
    if (categoryFilterBarContainer) {
        categoryFilterBarContainer.querySelectorAll('.category-filter-button.active').forEach(btn => {
            btn.classList.remove('active');
            const existingIcon = btn.querySelector('.clear-filter-icon');
            if (existingIcon) {
                existingIcon.remove();
            }
        });
    }

    // Vyčistíme všechny markery před novým vyhledáváním
    clearMapMarkers();

    // Spustíme hledání pro prázdný dotaz (načte vše v oblasti)
    performGenericSearch("");
    // hidePanelCompletely(); // Toto může být příliš agresivní, panel se sám otevřít s výsledky
}

// Detailní zobrazení v panelu (displayActivityDetailsInPanel, displayPlaceDetailsInPanel, displayCommunityDetailsInPanel)
// Zůstávají stejné.
function displayActivityDetailsInPanel(activityData) {
    if (!infoContentElement) return;
    // Pokud je definována globální funkce displayInfo (jako v index.html), použijeme ji
    if (typeof window.displayInfo === 'function' && infoPanelElement && infoPanelElement.id === "info-panel") {
        window.displayInfo(activityData, 'activity'); // Předáme i typ
        return;
    }
    // Fallback, pokud window.displayInfo není k dispozici
    let content = `<h2>${activityData.nazev || "Neznámá aktivita"}</h2>`;
    content += `<p><strong>Adresa:</strong> ${activityData.adresa || 'Neuvedeno'}</p>`;
    if (activityData.kategorie) content += `<p><strong>Kategorie:</strong> ${activityData.kategorie}</p>`;
    if (activityData.popis) content += `<p><strong>Popis:</strong> ${activityData.popis}</p>`;
    if (activityData.zacatek) content += `<p><strong>Začátek:</strong> ${new Date(activityData.zacatek).toLocaleString('cs-CZ')}</p>`;
    if (activityData.konec) content += `<p><strong>Konec:</strong> ${new Date(activityData.konec).toLocaleString('cs-CZ')}</p>`;
    if (activityData.cena) content += `<p><strong>Cena:</strong> ${activityData.cena}</p>`;
    if (activityData.web) content += `<p><strong>Web:</strong> <a href="${activityData.web.startsWith('http') ? activityData.web : 'http://' + activityData.web}" target="_blank" rel="noopener noreferrer">${activityData.web}</a></p>`;
    infoContentElement.innerHTML = content;
}

function displayPlaceDetailsInPanel(placeData) {
    if (!infoContentElement) return;
    if (typeof window.displayInfo === 'function' && infoPanelElement && infoPanelElement.id === "info-panel") {
        window.displayInfo(placeData, 'place');
        return;
    }
    let content = `<h2>${placeData.nazev || "Neznámé místo"}</h2>`;
    content += `<p><strong>Adresa:</strong> ${placeData.adresa || 'Neuvedeno'}</p>`;
    if (placeData.kategorie) content += `<p><strong>Kategorie:</strong> ${placeData.kategorie}</p>`;
    if (placeData.popis) content += `<p><strong>Popis:</strong> ${placeData.popis}</p>`;
    // ... další specifické informace pro místa ...
    infoContentElement.innerHTML = content;
}

function displayCommunityDetailsInPanel(communityData) {
    if (!infoContentElement) return;
    if (typeof window.displayInfo === 'function' && infoPanelElement && infoPanelElement.id === "info-panel") {
        window.displayInfo(communityData, 'community');
        return;
    }
    let content = `<h2>${communityData.nazev || "Neznámá komunita"}</h2>`;
    // Přizpůsobit pro komunity - adresa nemusí být relevantní, spíše lokalita
    if (communityData.lokalita) content += `<p><strong>Lokalita:</strong> ${communityData.lokalita.mesto || communityData.lokalita.region || 'Neuvedeno'}</p>`;
    else if (communityData.adresa) content += `<p><strong>Adresa:</strong> ${communityData.adresa}</p>`; // Fallback na adresu
    if (communityData.kategorie) content += `<p><strong>Kategorie:</strong> ${communityData.kategorie}</p>`;
    if (communityData.popis) content += `<p><strong>Popis:</strong> ${communityData.popis}</p>`;
    // ... další specifické informace pro komunity ...
    infoContentElement.innerHTML = content;
}

// Sekce s tlačítkem "Vyhledat v této oblasti" byla odstraněna
// a nahrazena automatickou aktualizací dat při změně pohledu na mapu


export async function searchByGeolocation(lat, lng, radius = 10) {
    const queryDisplay = `Okolí pozice [${lat.toFixed(3)}, ${lng.toFixed(3)}]`;
    lastGeneralSearchQuery = ""; // Resetujeme textové query
    isCategorySearch = false; // Resetujeme rychlý filtr kategorie

    // Zachováme aktuální filtry, pokud existují
    // Pokud chceme resetovat filtry, odkomentujte následující řádek:
    // currentActiveFilters = {};

    try {
        // Vytvoříme bounds pro aktuální pozici
        const earthRadiusKm = 6371;
        const latDiff = (radius / earthRadiusKm) * (180 / Math.PI);
        const lngDiff = (radius / (earthRadiusKm * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);

        const currentBounds = L.latLngBounds(
            [lat - latDiff, lng - lngDiff],
            [lat + latDiff, lng + lngDiff]
        );

        // Vytvoříme buffer bounds s větším poloměrem
        const bufferRadius = radius * 1.5; // 50% větší než radius
        const bufferLatDiff = (bufferRadius / earthRadiusKm) * (180 / Math.PI);
        const bufferLngDiff = (bufferRadius / (earthRadiusKm * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);

        const bufferBounds = L.latLngBounds(
            [lat - bufferLatDiff, lng - bufferLngDiff],
            [lat + bufferLatDiff, lng + bufferLngDiff]
        );

        // Hledáme podle lokace s aktuálními filtry a buffer bounds
        const results = await searchAPI.searchByLocation(lat, lng, bufferRadius, { filters: currentActiveFilters });
        renderGeneralSearchResults(queryDisplay, results, false, currentBounds, bufferBounds);

        if (results && (results.activities?.length || results.places?.length || results.communities?.length)) {
            const allItems = [...(results.activities || []), ...(results.places || []), ...(results.communities || [])];
            if (allItems.length === 1) {
                const singleItem = allItems[0];
                let type = '';
                if (results.activities?.includes(singleItem)) type = 'activity';
                else if (results.places?.includes(singleItem)) type = 'place';
                else if (results.communities?.includes(singleItem)) type = 'community';
                if (type) {
                     // Mírné zpoždění, aby se mapa stihla případně posunout/zoomovat z renderGeneralSearchResults
                    setTimeout(() => displaySingleItemOnMapAndInPanel(singleItem, type, true), 100);
                }
            }
        }

    } catch (error) {
        console.error(`Chyba při geolokačním vyhledávání pro [${lat},${lng}]:`, error);
        renderGeneralSearchResults(queryDisplay, { error: `Chyba: ${error.message}` }, false);
    }
}

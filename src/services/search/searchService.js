// src/services/search/searchService.js

class SearchService {
    constructor() {
        this.allData = {
            activities: [],
            places: [],
            communities: []
        };
        this.isInitialized = false;
        this.dataManifest = null; // Zatím nevyužito, ale připraveno
        this.searchCache = new Map(); // Přidáme cache pro výsledky vyhledávání
        this.CACHE_EXPIRATION_MS = 5 * 60 * 1000; // Cache na 5 minut
    }

    async initialize() {
        if (this.isInitialized) {
            console.log("SearchService je již inicializován.");
            return;
        }
        console.log("SearchService: Inicializace...");

        try {
            // TODO: V budoucnu načítat podle manifest.json
            // Načtení všech datových souborů
            const [activitiesData, placesData, communitiesData] = await Promise.all([
                this._loadDataFile('/data/aktivity_komapka.json', 'data/aktivity_komapka.json'),
                this._loadDataFile('/data/mista.json', 'data/mista.json'), // Předpoklad existence mista.json
                this._loadDataFile('/data/komunity.json', 'data/komunity.json') // Předpoklad existence komunity.json
            ]);

            this.allData.activities = activitiesData.map((item, index) => ({ ...item, id: item.id || `act-${index}`}));
            this.allData.places = placesData.map((item, index) => ({ ...item, id: item.id || `plc-${index}`}));
            this.allData.communities = communitiesData.map((item, index) => ({ ...item, id: item.id || `com-${index}`}));

            console.log(`SearchService: Načteno ${this.allData.activities.length} aktivit, ${this.allData.places.length} míst, ${this.allData.communities.length} komunit.`);

            this.isInitialized = true;
            console.log("SearchService: Inicializace dokončena.");
        } catch (error) {
            console.error("SearchService: Chyba při inicializaci:", error);
            this.isInitialized = false;
            throw error;
        }
    }

    async _loadDataFile(primaryPath, fallbackPath) {
        try {
            let response = await fetch(primaryPath);
            if (!response.ok) {
                console.warn(`Soubor ${primaryPath} nenalezen, zkouším ${fallbackPath}`);
                response = await fetch(fallbackPath);
                if (!response.ok) {
                    throw new Error(`Chyba při načítání dat (${fallbackPath}): ${response.statusText}`);
                }
            }
            const data = await response.json();
            // Pokud data nejsou pole (např. objekt s klíčem obsahujícím pole), upravíme to
            if (Array.isArray(data)) return data;
            if (typeof data === 'object' && data !== null) {
                const key = Object.keys(data)[0]; // Předpokládáme, že data jsou v prvním klíči
                if (key && Array.isArray(data[key])) return data[key];
            }
            console.warn(`Data ze souboru ${fallbackPath} nejsou ve formátu pole. Vracím prázdné pole.`);
            return [];
        } catch (error) {
            console.error(`Chyba při načítání souboru ${fallbackPath}:`, error);
            return []; // Vrátit prázdné pole v případě chyby
        }
    }

    getUniqueCategories() {
        if (!this.isInitialized) {
            console.warn("SearchService: Pokus o získání kategorií před inicializací.");
            return [];
        }
        const categories = new Set();
        const processItem = (item) => {
            if (item.kategorie) {
                if (Array.isArray(item.kategorie)) {
                    item.kategorie.forEach(cat => categories.add(cat.trim()));
                } else if (typeof item.kategorie === 'string') {
                    categories.add(item.kategorie.trim());
                }
            }
        };

        (this.allData.activities || []).forEach(processItem);
        (this.allData.places || []).forEach(processItem);
        (this.allData.communities || []).forEach(processItem);

        return Array.from(categories).sort();
    }

    /**
     * Získá unikátní hodnoty pro zadané pole z dat aktivit.
     * @param {string} fieldName - Název pole, pro které chceme získat unikátní hodnoty.
     * @returns {string[]} - Pole unikátních hodnot.
     */
    getUniqueFilterValues(fieldName) {
        if (!this.isInitialized) {
            console.warn(`SearchService: Pokus o získání unikátních hodnot pro ${fieldName} před inicializací.`);
            return [];
        }

        const values = new Set();

        (this.allData.activities || []).forEach(item => {
            const fieldValue = item[fieldName];
            if (fieldValue) {
                if (Array.isArray(fieldValue)) {
                    fieldValue.forEach(val => {
                        if (val) values.add(val.trim());
                    });
                } else if (typeof fieldValue === 'string') {
                    values.add(fieldValue.trim());
                }
            }
        });

        return Array.from(values).sort();
    }

    normalizeQuery(query) {
        if (!query) return "";
        return query.toString().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    _generateCacheKey(query, options) {
        const normalizedQuery = this.normalizeQuery(query);
        const boundsString = options.bounds ? options.bounds.toBBoxString() : 'none';
        const filtersString = options.filters ? JSON.stringify(options.filters) : 'none';
        return `q:${normalizedQuery}|b:${boundsString}|f:${filtersString}`;
    }

    async search(query, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
            if (!this.isInitialized) throw new Error("SearchService není inicializován.");
        }

        const cacheKey = this._generateCacheKey(query, options);
        if (this.searchCache.has(cacheKey)) {
            const cached = this.searchCache.get(cacheKey);
            if (cached.timestamp + this.CACHE_EXPIRATION_MS > Date.now()) {
                console.log("SearchService: Výsledky vráceny z cache pro klíč:", cacheKey);
                return JSON.parse(JSON.stringify(cached.data)); // Vrátit kopii dat z cache
            } else {
                this.searchCache.delete(cacheKey); // Cache expirovala
            }
        }

        const normalizedQuery = this.normalizeQuery(query);
        const filters = options.filters || {};

        // Výsledky vyhledávání
        let results = {
            activities: [],
            places: [],
            communities: []
        };

        // Výsledky pro zobrazení na mapě (omezené bounds)
        let mapResults = {
            activities: [],
            places: [],
            communities: []
        };

        // 1. Začneme s kopií všech dat
        let filteredActivities = [...(this.allData.activities || [])];
        let filteredPlaces = [...(this.allData.places || [])];
        let filteredCommunities = [...(this.allData.communities || [])];

        // 2. Filtrování podle textové lokality z pokročilých filtrů
        if (filters.location) {
            const normalizedLocation = this.normalizeQuery(filters.location);

            filteredActivities = filteredActivities.filter(item =>
                item.adresa && this.normalizeQuery(item.adresa).includes(normalizedLocation)
            );

            filteredPlaces = filteredPlaces.filter(item =>
                item.adresa && this.normalizeQuery(item.adresa).includes(normalizedLocation)
            );

            filteredCommunities = filteredCommunities.filter(item =>
                (item.adresa && this.normalizeQuery(item.adresa).includes(normalizedLocation)) ||
                (item.lokalita && (
                    (item.lokalita.mesto && this.normalizeQuery(item.lokalita.mesto).includes(normalizedLocation)) ||
                    (item.lokalita.region && this.normalizeQuery(item.lokalita.region).includes(normalizedLocation))
                ))
            );
        }

        // 3. Filtrování podle obecného textového dotazu
        if (normalizedQuery) {
            // Pokud je zadán textový dotaz, filtrujeme podle něj
            const filterByQuery = (item, itemType) => {
                const fieldsToSearch = [item.nazev, item.popis, item.kategorie, item.adresa, ...(item.tagy || [])];
                if (itemType === 'community' && item.lokalita) {
                    fieldsToSearch.push(item.lokalita.mesto, item.lokalita.region);
                }

                return fieldsToSearch.some(field => {
                    if (Array.isArray(field)) { // Pro pole kategorií/tagů
                        return field.some(val => val && this.normalizeQuery(val).includes(normalizedQuery));
                    }
                    return field && this.normalizeQuery(field).includes(normalizedQuery);
                });
            };

            filteredActivities = filteredActivities.filter(item => filterByQuery(item, 'activity'));
            filteredPlaces = filteredPlaces.filter(item => filterByQuery(item, 'place'));
            filteredCommunities = filteredCommunities.filter(item => filterByQuery(item, 'community'));
        }

        // 4. Aplikace ostatních pokročilých filtrů
        const applyAdvancedFilters = (item) => {
            // 4.1 Filtrování podle kategorie (Typ akce)
            if (filters.categories && filters.categories.length > 0 && item.kategorie) {
                const itemCategories = Array.isArray(item.kategorie) ? item.kategorie : [item.kategorie];
                const categoryMatch = filters.categories.some(filterCat =>
                    itemCategories.some(itemCat => this.normalizeQuery(itemCat) === this.normalizeQuery(filterCat))
                );
                if (!categoryMatch) return false;
            }

            // 4.2 Filtrování podle data
            if ((filters.dateFrom || filters.dateTo) && (item.zacatek || item.konec)) {
                const itemStartDate = item.zacatek ? new Date(item.zacatek) : null;
                const itemEndDate = item.konec ? new Date(item.konec) : (itemStartDate ? new Date(itemStartDate) : null);

                if (filters.dateFrom) {
                    const filterFromDate = new Date(filters.dateFrom);
                    // Akce končí před počátečním datem filtru
                    if (itemEndDate && itemEndDate < filterFromDate) {
                        return false;
                    }
                }

                if (filters.dateTo) {
                    const filterToDate = new Date(filters.dateTo);
                    // Akce začíná po koncovém datu filtru
                    if (itemStartDate && itemStartDate > filterToDate) {
                        return false;
                    }
                }
            }

            // 4.3 Filtrování podle vhodnosti pro
            if (filters.suitability && filters.suitability.length > 0 && item.vhodnost_pro) {
                console.log(`Filtrování podle vhodnosti pro: ${filters.suitability.join(', ')}, item.vhodnost_pro:`, item.vhodnost_pro);

                const itemSuitability = Array.isArray(item.vhodnost_pro) ? item.vhodnost_pro : [item.vhodnost_pro];
                const suitabilityMatch = filters.suitability.some(filterSuit =>
                    itemSuitability.some(itemSuit => {
                        const match = this.normalizeQuery(itemSuit) === this.normalizeQuery(filterSuit);
                        if (match) console.log(`Shoda nalezena pro vhodnost: ${itemSuit} = ${filterSuit}`);
                        return match;
                    })
                );

                if (!suitabilityMatch) {
                    console.log(`Položka neodpovídá filtru vhodnosti pro: ${filters.suitability.join(', ')}`);
                    return false;
                }

                console.log(`Položka odpovídá filtru vhodnosti pro: ${filters.suitability.join(', ')}`);
            }

            // 4.4 Filtrování podle cenového rozpětí
            if (filters.priceRange && filters.priceRange !== 'all') {
                console.log(`Filtrování podle cenového rozpětí: ${filters.priceRange}, item:`,
                    { cenove_rozpeti: item.cenove_rozpeti, cena: item.cena });

                // Mapování hodnot z formuláře na hodnoty v datech
                const priceRangeMapping = {
                    'zdarma': ['Vstup zdarma', 'zdarma'],
                    'do100': ['Do 100 Kč', 'do 100 kč', 'do 100kč'],
                    '100-500': ['100-500 Kč', '100-500 kč', '100-500kč'],
                    'nad500': ['Nad 500 Kč', 'nad 500 kč', 'nad 500kč']
                };

                // Získáme očekávané hodnoty pro vybraný filtr
                const expectedValues = priceRangeMapping[filters.priceRange] || [];

                // Kontrola shody v cenove_rozpeti
                if (item.cenove_rozpeti) {
                    const normalizedItemPrice = this.normalizeQuery(item.cenove_rozpeti);
                    const matchFound = expectedValues.some(val =>
                        normalizedItemPrice === this.normalizeQuery(val) ||
                        normalizedItemPrice.includes(this.normalizeQuery(val))
                    );

                    if (matchFound) {
                        console.log(`Shoda nalezena v cenove_rozpeti: ${item.cenove_rozpeti}`);
                        return true;
                    }
                }

                // Kontrola shody v cena
                if (item.cena) {
                    const normalizedItemPrice = this.normalizeQuery(item.cena);
                    const matchFound = expectedValues.some(val =>
                        normalizedItemPrice === this.normalizeQuery(val) ||
                        normalizedItemPrice.includes(this.normalizeQuery(val))
                    );

                    if (matchFound) {
                        console.log(`Shoda nalezena v cena: ${item.cena}`);
                        return true;
                    }
                }

                // Pokud jsme nenašli shodu ani v jednom poli, filtr neprošel
                console.log(`Položka neodpovídá filtru cenového rozpětí: ${filters.priceRange}`);
                return false;
            }

            // 4.5 Filtrování podle prostředí
            if (filters.environment && filters.environment !== 'all' && item.prostredi) {
                console.log(`Filtrování podle prostředí: ${filters.environment}, item.prostredi: ${item.prostredi}`);

                const normalizedItemEnv = this.normalizeQuery(item.prostredi);

                // Mapování hodnot z formuláře na hodnoty v datech
                const environmentMapping = {
                    'Outdoor': ['outdoor', 'venku', 'venkovni'],
                    'Indoor (za každého počasí)': ['indoor', 'vnitřní', 'vnitrni', 'za každého počasí'],
                    'Obojí': ['oboji', 'obojí', 'indoor i outdoor']
                };

                // Získáme očekávané hodnoty pro vybraný filtr
                const expectedValues = environmentMapping[filters.environment] || [];

                // Kontrola shody
                const matchFound = expectedValues.some(val =>
                    normalizedItemEnv.includes(this.normalizeQuery(val))
                );

                if (!matchFound) {
                    console.log(`Položka neodpovídá filtru prostředí: ${filters.environment}`);
                    return false;
                }

                console.log(`Shoda nalezena v prostředí: ${item.prostredi}`);
            }

            // 4.6 Filtrování podle zaměření
            if (filters.focus && filters.focus.length > 0 && item.zamereni) {
                console.log(`Filtrování podle zaměření: ${filters.focus.join(', ')}, item.zamereni:`, item.zamereni);

                const itemFocus = Array.isArray(item.zamereni) ? item.zamereni : [item.zamereni];
                const focusMatch = filters.focus.some(filterFocus => {
                    return itemFocus.some(itemFoc => {
                        const normalizedItemFoc = this.normalizeQuery(itemFoc);
                        const normalizedFilterFoc = this.normalizeQuery(filterFocus);
                        const match = normalizedItemFoc === normalizedFilterFoc;

                        if (match) console.log(`Shoda nalezena pro zaměření: ${itemFoc} = ${filterFocus}`);
                        return match;
                    });
                });

                if (!focusMatch) {
                    console.log(`Položka neodpovídá filtru zaměření: ${filters.focus.join(', ')}`);
                    return false;
                }

                console.log(`Položka odpovídá filtru zaměření: ${filters.focus.join(', ')}`);
            }

            // 4.7 Filtrování podle formátu akce
            if (filters.format && filters.format.length > 0 && item.format_akce) {
                console.log(`Filtrování podle formátu akce: ${filters.format.join(', ')}, item.format_akce:`, item.format_akce);

                const itemFormat = Array.isArray(item.format_akce) ? item.format_akce : [item.format_akce];
                const formatMatch = filters.format.some(filterFormat => {
                    return itemFormat.some(itemFmt => {
                        const normalizedItemFmt = this.normalizeQuery(itemFmt);
                        const normalizedFilterFmt = this.normalizeQuery(filterFormat);
                        const match = normalizedItemFmt === normalizedFilterFmt;

                        if (match) console.log(`Shoda nalezena pro formát akce: ${itemFmt} = ${filterFormat}`);
                        return match;
                    });
                });

                if (!formatMatch) {
                    console.log(`Položka neodpovídá filtru formátu akce: ${filters.format.join(', ')}`);
                    return false;
                }

                console.log(`Položka odpovídá filtru formátu akce: ${filters.format.join(', ')}`);
            }

            // 4.8 Filtrování podle jazyka
            if (filters.language && filters.language.length > 0 && item.jazyk_akce) {
                console.log(`Filtrování podle jazyka akce: ${filters.language.join(', ')}, item.jazyk_akce:`, item.jazyk_akce);

                const itemLanguage = Array.isArray(item.jazyk_akce) ? item.jazyk_akce : [item.jazyk_akce];
                const languageMatch = filters.language.some(filterLang => {
                    return itemLanguage.some(itemLang => {
                        const normalizedItemLang = this.normalizeQuery(itemLang);
                        const normalizedFilterLang = this.normalizeQuery(filterLang);
                        const match = normalizedItemLang === normalizedFilterLang;

                        if (match) console.log(`Shoda nalezena pro jazyk akce: ${itemLang} = ${filterLang}`);
                        return match;
                    });
                });

                if (!languageMatch) {
                    console.log(`Položka neodpovídá filtru jazyka akce: ${filters.language.join(', ')}`);
                    return false;
                }

                console.log(`Položka odpovídá filtru jazyka akce: ${filters.language.join(', ')}`);
            }

            // 4.9 Filtrování podle rezervace/vstupného
            if (filters.reservation && filters.reservation.length > 0 && item.rezervace_vstupne) {
                console.log(`Filtrování podle rezervace/vstupného: ${filters.reservation.join(', ')}, item.rezervace_vstupne:`, item.rezervace_vstupne);

                const itemReservation = Array.isArray(item.rezervace_vstupne) ? item.rezervace_vstupne : [item.rezervace_vstupne];

                // Speciální případ: pokud je v datech "Vstup zdarma" a v filtru "Vstup zdarma",
                // nebo pokud je v datech "Nutná rezervace" a v filtru "Nutná rezervace"
                const reservationMatch = filters.reservation.some(filterRes => {
                    return itemReservation.some(itemRes => {
                        const normalizedItemRes = this.normalizeQuery(itemRes);
                        const normalizedFilterRes = this.normalizeQuery(filterRes);
                        const match = normalizedItemRes === normalizedFilterRes ||
                                     normalizedItemRes.includes(normalizedFilterRes) ||
                                     normalizedFilterRes.includes(normalizedItemRes);

                        if (match) console.log(`Shoda nalezena pro rezervaci/vstupné: ${itemRes} ~ ${filterRes}`);
                        return match;
                    });
                });

                if (!reservationMatch) {
                    console.log(`Položka neodpovídá filtru rezervace/vstupného: ${filters.reservation.join(', ')}`);
                    return false;
                }

                console.log(`Položka odpovídá filtru rezervace/vstupného: ${filters.reservation.join(', ')}`);
            }

            // 4.10 Filtrování podle denní doby
            if (filters.timeOfDay && filters.timeOfDay.length > 0 && item.denni_doba) {
                console.log(`Filtrování podle denní doby: ${filters.timeOfDay.join(', ')}, item.denni_doba:`, item.denni_doba);

                const itemTimeOfDay = Array.isArray(item.denni_doba) ? item.denni_doba : [item.denni_doba];
                const timeOfDayMatch = filters.timeOfDay.some(filterTime => {
                    return itemTimeOfDay.some(itemTime => {
                        const normalizedItemTime = this.normalizeQuery(itemTime);
                        const normalizedFilterTime = this.normalizeQuery(filterTime);
                        const match = normalizedItemTime === normalizedFilterTime;

                        if (match) console.log(`Shoda nalezena pro denní dobu: ${itemTime} = ${filterTime}`);
                        return match;
                    });
                });

                if (!timeOfDayMatch) {
                    console.log(`Položka neodpovídá filtru denní doby: ${filters.timeOfDay.join(', ')}`);
                    return false;
                }

                console.log(`Položka odpovídá filtru denní doby: ${filters.timeOfDay.join(', ')}`);
            }

            return true;
        };

        // Aplikace pokročilých filtrů na všechny typy dat
        filteredActivities = filteredActivities.filter(applyAdvancedFilters);
        filteredPlaces = filteredPlaces.filter(applyAdvancedFilters);
        filteredCommunities = filteredCommunities.filter(applyAdvancedFilters);

        // Uložíme výsledky filtrování do results
        results.activities = filteredActivities;
        results.places = filteredPlaces;
        results.communities = filteredCommunities;

        // 5. Filtrování podle bounds (pouze pro zobrazení na mapě)
        if (options.bounds) {
            const filterByBounds = (item) => {
                if (item.latitude && item.longitude) {
                    const itemLatLng = L.latLng(item.latitude, item.longitude);
                    return options.bounds.contains(itemLatLng);
                }
                return false; // Nemá souřadnice, nemůže být v bounds
            };

            mapResults.activities = filteredActivities.filter(filterByBounds);
            mapResults.places = filteredPlaces.filter(filterByBounds);
            mapResults.communities = filteredCommunities.filter(filterByBounds);

            // Přidáme informaci o počtu položek v bounds a celkem
            results.mapBounds = {
                activities: mapResults.activities.length,
                places: mapResults.places.length,
                communities: mapResults.communities.length,
                total: mapResults.activities.length + mapResults.places.length + mapResults.communities.length
            };

            // Přidáme informaci o celkovém počtu položek
            results.total = {
                activities: results.activities.length,
                places: results.places.length,
                communities: results.communities.length,
                total: results.activities.length + results.places.length + results.communities.length
            };

            // Přidáme informaci o bounds
            results.bounds = options.bounds.toBBoxString();
        }

        console.log(`SearchService: Pro dotaz "${query}" (normalizováno: "${normalizedQuery}") s filtry:`, options.filters);
        console.log(`Nalezeno celkem: A:${results.activities.length}, P:${results.places.length}, C:${results.communities.length}`);
        if (options.bounds) {
            console.log(`Z toho v bounds: A:${mapResults.activities.length}, P:${mapResults.places.length}, C:${mapResults.communities.length}`);
        }

        // Uložení do cache
        this.searchCache.set(cacheKey, { data: JSON.parse(JSON.stringify(results)), timestamp: Date.now() });

        // Pokud jsou zadány bounds, vrátíme výsledky pro mapu, jinak všechny výsledky
        if (options.bounds && options.returnMapResultsOnly) {
            return mapResults;
        }

        return results;
    }

    async getSuggestions(query) {
        if (!this.isInitialized) await this.initialize();
        const normalizedQuery = this.normalizeQuery(query);
        if (!normalizedQuery || normalizedQuery.length < 2) return [];

        const suggestions = [];
        const MAX_SUGGESTIONS = 10;

        const addSuggestion = (item, type) => {
            if (suggestions.length >= MAX_SUGGESTIONS) return;
            // Zkontrolujeme, zda už podobný návrh (podle textu) neexistuje
            if (!suggestions.some(s => s.text.toLowerCase() === item.nazev.toLowerCase())) {
                 suggestions.push({
                    text: item.nazev,
                    data: item, // Celý objekt položky
                    type: type === 'activity' ? 'Aktivita' : (type === 'place' ? 'Místo' : 'Komunita')
                });
            }
        };

        (this.allData.activities || []).forEach(item => {
            if (this.normalizeQuery(item.nazev).includes(normalizedQuery)) addSuggestion(item, 'activity');
        });
        if (suggestions.length < MAX_SUGGESTIONS) {
            (this.allData.places || []).forEach(item => {
                if (this.normalizeQuery(item.nazev).includes(normalizedQuery)) addSuggestion(item, 'place');
            });
        }
        if (suggestions.length < MAX_SUGGESTIONS) {
            (this.allData.communities || []).forEach(item => {
                if (this.normalizeQuery(item.nazev).includes(normalizedQuery)) addSuggestion(item, 'community');
            });
        }
        return suggestions;
    }

    async geocodeLocation(query) {
        if (!this.isInitialized) await this.initialize();
        console.warn("SearchService: geocodeLocation je zjednodušené.");
        const normalizedQuery = this.normalizeQuery(query);
        if (normalizedQuery.includes("praha")) {
            return {
                name: "Praha",
                bounds: L.latLngBounds(L.latLng(49.9417, 14.2244), L.latLng(50.1772, 14.7068))
            };
        }
        if (normalizedQuery.includes("brno")) {
            return {
                name: "Brno",
                bounds: L.latLngBounds(L.latLng(49.1127, 16.4400), L.latLng(49.2800, 16.7550))
            };
        }
        return null;
    }

    async searchByLocation(lat, lng, radiusKm = 10, options = {}) {
        if (!this.isInitialized) await this.initialize();

        // Pro jednoduchost použijeme čtvercové hranice aproximující kruh
        const earthRadiusKm = 6371;
        const latDiff = (radiusKm / earthRadiusKm) * (180 / Math.PI);
        const lngDiff = (radiusKm / (earthRadiusKm * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);

        const searchBounds = L.latLngBounds(
            [lat - latDiff, lng - lngDiff],
            [lat + latDiff, lng + lngDiff]
        );

        // Použijeme existující search metodu s bounds a předanými filtry
        // Prázdný textový dotaz znamená, že hledáme vše v dané oblasti/filtrech
        // Nastavíme returnMapResultsOnly na true, protože chceme pouze výsledky v dané oblasti
        return this.search("", {
            ...options,
            bounds: searchBounds,
            returnMapResultsOnly: true // Chceme pouze výsledky v dané oblasti
        });
    }
}

export const searchService = new SearchService();
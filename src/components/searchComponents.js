/**
 * Komponenty pro vyhledávání v aplikaci KOMAPKA
 */

import { searchAPI } from '../services/search/searchAPI.js';

// Globální proměnné
let searchTimeout = null;
let currentQuery = '';
const SEARCH_DELAY = 200; // ms

/**
 * Vytvoří a inicializuje vyhledávací pole
 * @param {HTMLElement} container - kontejner pro vyhledávací pole
 * @param {Function} onSearch - callback funkce pro vyhledávání (očekává: (query, dataObject))
 * @param {Function} onFilterButtonClickCallback - callback funkce pro kliknutí na tlačítko filtru
 * @returns {object} - Objekt obsahující elementy { searchInput, suggestionsContainer, filterButton }
 */
export function createSearchField(container, onSearch, onFilterButtonClickCallback) {
    container.innerHTML = ''; // Vyčistíme kontejner

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';

    const searchForm = document.createElement('form');
    searchForm.className = 'search-form';
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            onSearch(query, null); // null for suggestionData if direct search
            hideSuggestions(searchContainer); // Skryjeme návrhy po odeslání
        }
    });

    // Input pro vyhledávání (bez ikony lupy)
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = 'Hledejte aktivity, místa nebo komunity...';
    searchInput.setAttribute('autocomplete', 'off');

    // Tlačítko pro filtry (menší, vlevo od lupy)
    const filterButton = document.createElement('button');
    filterButton.type = 'button'; // Důležité, aby neodesílalo formulář
    filterButton.className = 'filter-button-new';
    filterButton.innerHTML = '<i class="fas fa-filter"></i>'; // Ikona filtru (předpokládá Font Awesome)
    filterButton.title = 'Zobrazit filtry';
    if (onFilterButtonClickCallback) {
        filterButton.addEventListener('click', onFilterButtonClickCallback);
    }

    // Tlačítko pro odeslání vyhledávání (lupa, žluté, vpravo)
    const searchSubmitButton = document.createElement('button');
    searchSubmitButton.type = 'submit';
    searchSubmitButton.className = 'search-submit-button';
    searchSubmitButton.innerHTML = '<i class="fas fa-search"></i>';
    searchSubmitButton.title = 'Hledat';

    searchForm.appendChild(searchInput);       // Input první
    searchForm.appendChild(filterButton);      // Pak tlačítko filtru
    searchForm.appendChild(searchSubmitButton);// Nakonec tlačítko lupy (submit)
    searchContainer.appendChild(searchForm);

    const suggestionsContainerElement = document.createElement('div');
    suggestionsContainerElement.className = 'suggestions-container';
    suggestionsContainerElement.style.display = 'none';
    searchContainer.appendChild(suggestionsContainerElement);

    // Event listenery pro input a suggestions (zůstávají víceméně stejné)
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        currentQuery = query;
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        if (!query || query.length < 2) {
            hideSuggestions(searchContainer);
            return;
        }
        searchTimeout = setTimeout(() => {
            showSuggestions(query, searchContainer, onSearch);
        }, SEARCH_DELAY);
    });

    searchInput.addEventListener('keydown', (e) => {
        const suggestionsVisible = suggestionsContainerElement.style.display !== 'none';
        if (!suggestionsVisible) return;

        const suggestions = suggestionsContainerElement.querySelectorAll('.suggestion-item');
        if (!suggestions.length) return;

        let activeIndex = -1;
        suggestions.forEach((s, i) => {
            if (s.classList.contains('active')) activeIndex = i;
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % suggestions.length;
            setActiveSuggestion(suggestions, activeIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
            setActiveSuggestion(suggestions, activeIndex);
        } else if (e.key === 'Enter') {
            if (activeIndex !== -1) {
                e.preventDefault();
                suggestions[activeIndex].click();
            } else {
                // Pokud není vybrán návrh, formulář se odešle standardně (viz searchForm submit listener)
                hideSuggestions(searchContainer);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideSuggestions(searchContainer);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            hideSuggestions(searchContainer);
        }
    });

    container.appendChild(searchContainer);
    return {
        searchInput,
        suggestionsContainer: suggestionsContainerElement,
        filterButton,
        searchSubmitButton
    };
}

/**
 * Vytvoří základní panel pro filtry.
 * @param {HTMLElement} targetContainer - Kontejner, kam se panel přidá (např. pod vyhledávací lištu).
 * @param {Object|string[]} filterValues - Objekt s unikátními hodnotami pro filtry nebo pole kategorií (zpětná kompatibilita).
 * @param {string[]} [filterValues.categories] - Pole dostupných kategorií.
 * @param {string[]} [filterValues.vhodnostPro] - Pole dostupných hodnot pro vhodnost.
 * @param {string[]} [filterValues.prostredi] - Pole dostupných hodnot pro prostředí.
 * @param {string[]} [filterValues.zamereni] - Pole dostupných hodnot pro zaměření.
 * @param {string[]} [filterValues.formatAkce] - Pole dostupných hodnot pro formát akce.
 * @param {string[]} [filterValues.jazykAkce] - Pole dostupných hodnot pro jazyk akce.
 * @param {string[]} [filterValues.rezervaceVstupne] - Pole dostupných hodnot pro rezervace a vstupné.
 * @param {string[]} [filterValues.denniDoba] - Pole dostupných hodnot pro denní dobu.
 * @param {Function} onApplyFiltersCallback - Callback po kliknutí na "Použít filtry".
 * @returns {HTMLElement} - Vytvořený element panelu filtrů.
 */
export function createFilterPanel(targetContainer, filterValues = [], onApplyFiltersCallback) {
    // Zajistíme, že filterValues je objekt, i když je předáno pole (zpětná kompatibilita)
    let categories = [];
    let vhodnostPro = [];
    let prostredi = [];
    let zamereni = [];
    let formatAkce = [];
    let jazykAkce = [];
    let rezervaceVstupne = [];
    let denniDoba = [];

    if (Array.isArray(filterValues)) {
        categories = filterValues;
    } else {
        categories = filterValues.categories || [];
        vhodnostPro = filterValues.vhodnostPro || [];
        prostredi = filterValues.prostredi || [];
        zamereni = filterValues.zamereni || [];
        formatAkce = filterValues.formatAkce || [];
        jazykAkce = filterValues.jazykAkce || [];
        rezervaceVstupne = filterValues.rezervaceVstupne || [];
        denniDoba = filterValues.denniDoba || [];
    }
    let panel = targetContainer.querySelector('#filter-panel-komapka');
    if (panel) panel.remove(); // Odstraníme existující, pokud je

    panel = document.createElement('div');
    panel.id = 'filter-panel-komapka';
    panel.className = 'filter-panel hidden'; // Začíná skrytý

    // Získáme aktuální datum pro výchozí hodnoty datumových filtrů
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Najdeme nejbližší víkend (sobota a neděle)
    const weekendStart = new Date(today);
    const dayToSaturday = (6 - weekendStart.getDay()) % 7; // 0 = neděle, 6 = sobota
    weekendStart.setDate(weekendStart.getDate() + (dayToSaturday === 0 ? 6 : dayToSaturday));
    const weekendEnd = new Date(weekendStart);
    weekendEnd.setDate(weekendEnd.getDate() + 1); // Neděle

    // Formátování dat pro input[type="date"]
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayFormatted = formatDate(today);
    const tomorrowFormatted = formatDate(tomorrow);
    const weekendStartFormatted = formatDate(weekendStart);
    const weekendEndFormatted = formatDate(weekendEnd);

    panel.innerHTML = `
        <div class="filter-panel-header">
            <h4>Pokročilé filtry</h4>
            <button class="filter-panel-close-btn" title="Zavřít filtry">×</button>
        </div>
        <div class="filter-panel-content">
            <!-- A. Typ akce (Kategorie) -->
            <div class="filter-group">
                <h5>Typ akce (Kategorie)</h5>
                <div class="filter-options filter-checkboxes">
                    ${categories.length > 0 ?
                        categories.map(cat => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_typAkce" value="${cat}">
                                <span class="filter-checkbox-text">${cat}</span>
                            </label>
                        `).join('') :
                        '<p class="filter-no-options">Žádné kategorie k dispozici</p>'
                    }
                </div>
            </div>

            <!-- B. Lokalita -->
            <div class="filter-group">
                <h5>Lokalita</h5>
                <div class="filter-options">
                    <input type="text" name="filter_lokalita_text" placeholder="Např. Praha, Brno..." class="filter-text-input">
                </div>
            </div>

            <!-- C. Datum -->
            <div class="filter-group">
                <h5>Datum</h5>
                <div class="filter-options filter-date-range">
                    <div class="filter-date-inputs">
                        <div class="filter-date-field">
                            <label>Od:</label>
                            <input type="date" name="filter_datum_od" class="filter-date-input">
                        </div>
                        <div class="filter-date-field">
                            <label>Do:</label>
                            <input type="date" name="filter_datum_do" class="filter-date-input">
                        </div>
                    </div>
                    <div class="filter-date-quick-buttons">
                        <button type="button" class="filter-date-quick-btn" data-from="${todayFormatted}" data-to="${todayFormatted}">Dnes</button>
                        <button type="button" class="filter-date-quick-btn" data-from="${tomorrowFormatted}" data-to="${tomorrowFormatted}">Zítra</button>
                        <button type="button" class="filter-date-quick-btn" data-from="${weekendStartFormatted}" data-to="${weekendEndFormatted}">Víkend</button>
                    </div>
                </div>
            </div>

            <!-- D. Vhodnost pro -->
            <div class="filter-group">
                <h5>Vhodnost pro</h5>
                <div class="filter-options filter-checkboxes">
                    ${vhodnostPro.length > 0 ?
                        vhodnostPro.map(val => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_vhodnostPro" value="${val}">
                                <span class="filter-checkbox-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_vhodnostPro" value="Děti">
                            <span class="filter-checkbox-text">Děti</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_vhodnostPro" value="Senioři">
                            <span class="filter-checkbox-text">Senioři</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_vhodnostPro" value="Handicapovaní">
                            <span class="filter-checkbox-text">Handicapovaní</span>
                        </label>`
                    }
                </div>
            </div>

            <!-- E. Cenové rozpětí -->
            <div class="filter-group">
                <h5>Cenové rozpětí</h5>
                <div class="filter-options filter-radio-buttons">
                    <label class="filter-radio-label">
                        <input type="radio" name="filter_cena" value="all" checked>
                        <span class="filter-radio-text">Vše (bez omezení ceny)</span>
                    </label>
                    <label class="filter-radio-label">
                        <input type="radio" name="filter_cena" value="zdarma">
                        <span class="filter-radio-text">Vstup zdarma</span>
                    </label>
                    <label class="filter-radio-label">
                        <input type="radio" name="filter_cena" value="do100">
                        <span class="filter-radio-text">Do 100 Kč</span>
                    </label>
                    <label class="filter-radio-label">
                        <input type="radio" name="filter_cena" value="100-500">
                        <span class="filter-radio-text">100-500 Kč</span>
                    </label>
                    <label class="filter-radio-label">
                        <input type="radio" name="filter_cena" value="nad500">
                        <span class="filter-radio-text">Nad 500 Kč</span>
                    </label>
                </div>
            </div>

            <!-- F. Indoor/Outdoor -->
            <div class="filter-group">
                <h5>Prostředí</h5>
                <div class="filter-options filter-radio-buttons">
                    <label class="filter-radio-label">
                        <input type="radio" name="filter_prostredi" value="all" checked>
                        <span class="filter-radio-text">Vše</span>
                    </label>
                    ${prostredi.length > 0 ?
                        prostredi.map(val => `
                            <label class="filter-radio-label">
                                <input type="radio" name="filter_prostredi" value="${val}">
                                <span class="filter-radio-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-radio-label">
                            <input type="radio" name="filter_prostredi" value="Outdoor">
                            <span class="filter-radio-text">Outdoor</span>
                        </label>
                        <label class="filter-radio-label">
                            <input type="radio" name="filter_prostredi" value="Indoor (za každého počasí)">
                            <span class="filter-radio-text">Indoor (za každého počasí)</span>
                        </label>
                        <label class="filter-radio-label">
                            <input type="radio" name="filter_prostredi" value="Obojí">
                            <span class="filter-radio-text">Obojí</span>
                        </label>`
                    }
                </div>
            </div>

            <!-- G. Zaměření (Téma) -->
            <div class="filter-group">
                <h5>Zaměření (Téma)</h5>
                <div class="filter-options filter-checkboxes">
                    ${zamereni.length > 0 ?
                        zamereni.map(val => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_zamereni" value="${val}">
                                <span class="filter-checkbox-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_zamereni" value="Hudba">
                            <span class="filter-checkbox-text">Hudba</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_zamereni" value="Umění">
                            <span class="filter-checkbox-text">Umění</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_zamereni" value="Sport">
                            <span class="filter-checkbox-text">Sport</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_zamereni" value="Vzdělávání">
                            <span class="filter-checkbox-text">Vzdělávání</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_zamereni" value="Gastronomie">
                            <span class="filter-checkbox-text">Gastronomie</span>
                        </label>`
                    }
                </div>
            </div>

            <!-- H. Formát akce -->
            <div class="filter-group">
                <h5>Formát akce</h5>
                <div class="filter-options filter-checkboxes">
                    ${formatAkce.length > 0 ?
                        formatAkce.map(val => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_format" value="${val}">
                                <span class="filter-checkbox-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_format" value="Festival">
                            <span class="filter-checkbox-text">Festival</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_format" value="Výstava">
                            <span class="filter-checkbox-text">Výstava</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_format" value="Koncert">
                            <span class="filter-checkbox-text">Koncert</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_format" value="Představení">
                            <span class="filter-checkbox-text">Představení</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_format" value="Workshop / Kurz">
                            <span class="filter-checkbox-text">Workshop / Kurz</span>
                        </label>`
                    }
                </div>
            </div>

            <!-- I. Jazyk akce -->
            <div class="filter-group">
                <h5>Jazyk akce</h5>
                <div class="filter-options filter-checkboxes">
                    ${jazykAkce.length > 0 ?
                        jazykAkce.map(val => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_jazyk" value="${val}">
                                <span class="filter-checkbox-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_jazyk" value="Čeština">
                            <span class="filter-checkbox-text">Čeština</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_jazyk" value="Angličtina">
                            <span class="filter-checkbox-text">Angličtina</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_jazyk" value="Vícejazyčná">
                            <span class="filter-checkbox-text">Vícejazyčná</span>
                        </label>`
                    }
                </div>
            </div>

            <!-- J. Rezervace a vstupné -->
            <div class="filter-group">
                <h5>Rezervace a vstupné</h5>
                <div class="filter-options filter-checkboxes">
                    ${rezervaceVstupne.length > 0 ?
                        rezervaceVstupne.map(val => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_rezervace" value="${val}">
                                <span class="filter-checkbox-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_rezervace" value="Vstup zdarma">
                            <span class="filter-checkbox-text">Vstup zdarma</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_rezervace" value="Nutná rezervace">
                            <span class="filter-checkbox-text">Nutná rezervace</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_rezervace" value="Vstupenky v předprodeji">
                            <span class="filter-checkbox-text">Vstupenky v předprodeji</span>
                        </label>`
                    }
                </div>
            </div>

            <!-- K. Denní doba -->
            <div class="filter-group">
                <h5>Denní doba</h5>
                <div class="filter-options filter-checkboxes">
                    ${denniDoba.length > 0 ?
                        denniDoba.map(val => `
                            <label class="filter-checkbox-label">
                                <input type="checkbox" name="filter_denniDoba" value="${val}">
                                <span class="filter-checkbox-text">${val}</span>
                            </label>
                        `).join('') :
                        `<label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_denniDoba" value="Ranní">
                            <span class="filter-checkbox-text">Ranní</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_denniDoba" value="Odpolední">
                            <span class="filter-checkbox-text">Odpolední</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_denniDoba" value="Večerní">
                            <span class="filter-checkbox-text">Večerní</span>
                        </label>
                        <label class="filter-checkbox-label">
                            <input type="checkbox" name="filter_denniDoba" value="Noční">
                            <span class="filter-checkbox-text">Noční</span>
                        </label>`
                    }
                </div>
            </div>
        </div>
        <div class="filter-panel-footer">
            <button class="clear-filters-btn">Vymazat filtry</button>
            <button class="apply-filters-btn">Použít filtry</button>
        </div>
    `;

    // Přidání event listenerů pro tlačítka rychlého výběru data
    panel.querySelectorAll('.filter-date-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromDate = btn.getAttribute('data-from');
            const toDate = btn.getAttribute('data-to');
            panel.querySelector('input[name="filter_datum_od"]').value = fromDate;
            panel.querySelector('input[name="filter_datum_do"]').value = toDate;
        });
    });

    // Event listener pro zavření panelu
    const closeButton = panel.querySelector('.filter-panel-close-btn');
    closeButton.addEventListener('click', () => {
        const isPanelVisible = toggleFilterPanelVisibility(false);
        // Aktualizujeme stav tlačítka filtru
        const filterButton = document.querySelector('.filter-button-new');
        if (filterButton) {
            filterButton.classList.toggle('active', isPanelVisible);
        }
    });

    // Event listener pro vymazání filtrů
    const clearButton = panel.querySelector('.clear-filters-btn');
    clearButton.addEventListener('click', () => clearAllFilterInputs(panel));

    // Event listener pro aplikaci filtrů
    const applyButton = panel.querySelector('.apply-filters-btn');
    applyButton.addEventListener('click', () => {
        const activeFilters = collectActiveFilters(panel);
        if (onApplyFiltersCallback) {
            onApplyFiltersCallback(activeFilters);
        }
        // Skryjeme panel po aplikaci a aktualizujeme stav tlačítka
        const isPanelVisible = toggleFilterPanelVisibility(false);
        const filterButton = document.querySelector('.filter-button-new');
        if (filterButton) {
            filterButton.classList.toggle('active', isPanelVisible);
        }
    });

    targetContainer.appendChild(panel);
    return panel;
}

/**
 * Sbírá aktivní filtry z panelu filtrů.
 * @param {HTMLElement} filterPanelElement - Element panelu filtrů.
 * @returns {Object} - Objekt s aktivními filtry.
 */
function collectActiveFilters(filterPanelElement) {
    const activeFilters = {};

    // Zpracování checkboxů (pro filtry s více možnostmi)
    const checkboxGroups = [
        'filter_typAkce', 'filter_vhodnostPro', 'filter_zamereni',
        'filter_format', 'filter_jazyk', 'filter_rezervace', 'filter_denniDoba'
    ];

    checkboxGroups.forEach(groupName => {
        const checkedValues = [];
        filterPanelElement.querySelectorAll(`input[name="${groupName}"]:checked`).forEach(cb => {
            checkedValues.push(cb.value);
        });
        if (checkedValues.length > 0) {
            activeFilters[groupName] = checkedValues;
        }
    });

    // Zpracování radio buttonů (pro filtry s jednou možností)
    const radioGroups = ['filter_cena', 'filter_prostredi'];

    radioGroups.forEach(groupName => {
        const selectedRadio = filterPanelElement.querySelector(`input[name="${groupName}"]:checked`);
        if (selectedRadio && selectedRadio.value !== 'all') {
            activeFilters[groupName] = selectedRadio.value;
        }
    });

    // Zpracování textových polí
    const textInput = filterPanelElement.querySelector('input[name="filter_lokalita_text"]');
    if (textInput && textInput.value.trim()) {
        activeFilters.filter_lokalita_text = textInput.value.trim();
    }

    // Zpracování datumových polí
    const dateFrom = filterPanelElement.querySelector('input[name="filter_datum_od"]');
    const dateTo = filterPanelElement.querySelector('input[name="filter_datum_do"]');

    if (dateFrom && dateFrom.value) {
        activeFilters.filter_datum_od = dateFrom.value;
    }

    if (dateTo && dateTo.value) {
        activeFilters.filter_datum_do = dateTo.value;
    }

    return activeFilters;
}

/**
 * Vymaže všechny filtry v panelu filtrů.
 * @param {HTMLElement} filterPanelElement - Element panelu filtrů.
 */
function clearAllFilterInputs(filterPanelElement) {
    // Vymazání checkboxů
    filterPanelElement.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Resetování radio buttonů na výchozí hodnoty
    filterPanelElement.querySelectorAll('input[name="filter_cena"][value="all"]').forEach(radio => {
        radio.checked = true;
    });
    filterPanelElement.querySelectorAll('input[name="filter_prostredi"][value="all"]').forEach(radio => {
        radio.checked = true;
    });

    // Vymazání textových polí
    filterPanelElement.querySelectorAll('input[type="text"]').forEach(input => {
        input.value = '';
    });

    // Vymazání datumových polí
    filterPanelElement.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = '';
    });

    // Aktualizujeme stav tlačítka filtrů
    const filterButton = document.querySelector('.filter-button-new');
    if (filterButton) {
        // Odstraníme třídu has-active-filters, protože jsme vymazali všechny filtry
        filterButton.classList.remove('has-active-filters');
    }
}

/**
 * Přepíná viditelnost panelu filtrů a skrývá/zobrazuje rychlé filtry kategorií.
 * @param {boolean} [forceShow] - Pokud true, panel se zobrazí. Pokud false, skryje. Pokud undefined, přepne.
 * @returns {boolean} - Vrací true, pokud je panel po provedení akce viditelný, jinak false.
 */
export function toggleFilterPanelVisibility(forceShow) {
    const panel = document.getElementById('filter-panel-komapka');
    if (!panel) return false;

    const shouldShow = forceShow === undefined ? panel.classList.contains('hidden') : forceShow;

    // Získáme referenci na kontejner rychlých filtrů kategorií
    const categoryFilterBarContainer = document.getElementById('category-filter-bar-container');

    if (shouldShow) {
        panel.classList.remove('hidden');
        // Skryjeme rychlé filtry kategorií, když je panel pokročilých filtrů otevřený
        if (categoryFilterBarContainer) {
            categoryFilterBarContainer.classList.add('hidden-by-advanced-filter');
        }
    } else {
        panel.classList.add('hidden');
        // Zobrazíme rychlé filtry kategorií, když je panel pokročilých filtrů zavřený
        if (categoryFilterBarContainer) {
            categoryFilterBarContainer.classList.remove('hidden-by-advanced-filter');
        }
    }

    // Aktualizujeme stav tlačítka filtrů
    const filterButton = document.querySelector('.filter-button-new');
    if (filterButton) {
        // Aktualizujeme třídu active podle viditelnosti panelu
        filterButton.classList.toggle('active', shouldShow);

        // Zkontrolujeme, zda jsou aktivní nějaké filtry
        // Toto je jen vizuální kontrola, skutečný stav filtrů je v search.js
        const hasActiveFilters = panel.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked:not([value="all"]), input[type="text"]:not([value=""]):not(:placeholder-shown), input[type="date"]:not([value=""])').length > 0;

        // Aktualizujeme třídu has-active-filters podle stavu filtrů
        filterButton.classList.toggle('has-active-filters', hasActiveFilters);
    }

    // Vrátíme aktuální stav viditelnosti panelu (true = viditelný, false = skrytý)
    return !panel.classList.contains('hidden');
}


/**
 * Zobrazení našeptávače
 * @param {string} query - vyhledávací dotaz
 * @param {HTMLElement} searchFieldContainer - kontejner celého vyhledávacího pole (.search-container)
 * @param {Function} onSearchCallback - callback funkce pro vyhledávání
 */
async function showSuggestions(query, searchFieldContainer, onSearchCallback) {
    if (query !== currentQuery) return;

    try {
        const suggestionResults = await searchAPI.getSuggestions(query);

        if (query !== currentQuery) return;

        const suggestionsContainer = searchFieldContainer.querySelector('.suggestions-container');
        if (!suggestionsContainer) return;

        suggestionsContainer.innerHTML = '';

        if (!suggestionResults || !suggestionResults.length) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        suggestionResults.forEach((suggestion, index) => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';

            const highlightedText = highlightText(suggestion.text, query);
            suggestionItem.innerHTML = `
                <div class="suggestion-text">${highlightedText}</div>
                <div class="suggestion-type">${suggestion.type}</div>
            `;

            suggestionItem.addEventListener('click', () => {
                const searchInput = searchFieldContainer.querySelector('.search-input');
                if (searchInput) {
                    searchInput.value = suggestion.text;
                    currentQuery = suggestion.text;
                }
                hideSuggestions(searchFieldContainer); // Použijeme upravenou funkci hideSuggestions

                // Původní logika pro určení itemTypeInternal a volání onSearchCallback
                let itemTypeInternal = '';
                const suggestionDisplayType = suggestion.type.toLowerCase();
                if (suggestionDisplayType.includes('aktivita')) itemTypeInternal = 'activity';
                else if (suggestionDisplayType.includes('místo')) itemTypeInternal = 'place';
                else if (suggestionDisplayType.includes('komunita')) itemTypeInternal = 'community';

                if (suggestion.data && itemTypeInternal) {
                    onSearchCallback(suggestion.text, { item: suggestion.data, type: itemTypeInternal });
                } else {
                    console.warn("Chybí data pro vybraný návrh nebo neznámý typ:", suggestion);
                    onSearchCallback(suggestion.text, null); // Padne zpět na obecné textové vyhledávání
                }
            });

            suggestionItem.addEventListener('mouseenter', () => {
                setActiveSuggestion(suggestionsContainer.querySelectorAll('.suggestion-item'), index);
            });

            suggestionsContainer.appendChild(suggestionItem);
        });
        suggestionsContainer.style.display = 'block';
    } catch (error) {
        console.error('Chyba při získávání návrhů:', error);
        hideSuggestions(searchFieldContainer);
    }
}

/**
 * Skrytí našeptávače
 * @param {HTMLElement} [searchContainer] - Kontejner .search-container. Pokud není zadán, pokusí se najít.
 */
export function hideSuggestions(searchContainer = null) {
    let currentSearchContainer = searchContainer;
    if (!currentSearchContainer) {
        // Pokusíme se najít aktivní search-container, pokud existuje.
        // Toto je záložní varianta, ideálně by měl být searchContainer vždy předán.
        const firstSearchContainer = document.querySelector('.search-container');
        if (firstSearchContainer) {
            currentSearchContainer = firstSearchContainer;
        }
    }

    if (currentSearchContainer) {
        const suggestionsContainer = currentSearchContainer.querySelector('.suggestions-container');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    } else {
        // Fallback pro starší volání, kde se hledalo globálně (méně spolehlivé)
        const globalSuggestions = document.querySelector('.suggestions-container');
        if (globalSuggestions) {
            globalSuggestions.style.display = 'none';
        }
    }
}


function setActiveSuggestion(suggestions, activeIndex) {
    suggestions.forEach((s, i) => {
        s.classList.toggle('active', i === activeIndex);
    });
}

function highlightText(text, query) {
    if (!query || !text) return text || '';
    // Tato funkce pro normalizaci by měla být ideálně sdílená s searchService
    const normalizeString = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const normalizedText = normalizeString(text);
    const normalizedQuery = normalizeString(query);

    let startIndex = 0;
    let result = '';
    let originalTextPointer = 0;

    while(startIndex < normalizedText.length) {
        const index = normalizedText.indexOf(normalizedQuery, startIndex);
        if (index === -1) {
            result += text.substring(originalTextPointer);
            break;
        }

        // Najít odpovídající segment v původním textu
        // Toto je zjednodušení. Správné mapování indexů mezi normalizovaným a originálním textem
        // může být komplexní kvůli různým délkám znaků po normalizaci (např. 'č' -> 'cˇ').
        // Pro jednoduché zvýraznění to ale často stačí.

        // Poznámka: Přesné mapování indexů mezi normalizovaným a originálním textem
        // by vyžadovalo iteraci znak po znaku a porovnávání délek, což je složité.
        // Místo toho použijeme jednodušší přístup s hledáním v originálním textu.

        // Bezpečnější, ale méně přesné zvýraznění:
        const originalQueryStartIndex = text.toLowerCase().indexOf(query.toLowerCase(), originalTextPointer);
        if (originalQueryStartIndex !== -1) {
            result += text.substring(originalTextPointer, originalQueryStartIndex);
            result += `<strong>${text.substring(originalQueryStartIndex, originalQueryStartIndex + query.length)}</strong>`;
            originalTextPointer = originalQueryStartIndex + query.length;
            startIndex = index + normalizedQuery.length;
        } else {
            // Fallback, pokud nenajdeme v originálním textu přesnou shodu (což by nemělo nastat, pokud normalizace funguje)
            result += text.substring(originalTextPointer);
            break;
        }
    }
    return result || text; // Pokud se nic nenahradilo, vrátit původní text
}


export function createSearchResultsListContainer(targetPanelElement) {
    let listWrapper = targetPanelElement.querySelector('.search-results-list-wrapper');
    if (!listWrapper) {
        listWrapper = document.createElement('div');
        listWrapper.className = 'search-results-list-wrapper';
        targetPanelElement.appendChild(listWrapper);
    }
    return listWrapper;
}


/**
 * Zobrazení SEZNAMU výsledků vyhledávání v daném kontejneru (panelu).
 * @param {string} query - vyhledávací dotaz (pro zobrazení titulku)
 * @param {Object} results - výsledky vyhledávání ({activities, places, communities})
 * @param {HTMLElement} listDisplayContainer - kontejner, kam se má seznam vykreslit
 * @param {Function} onItemClickCallback - callback po kliknutí na položku seznamu (item, type) => {}
 * @param {string} initialSelectedTabKey - klíč záložky ('activities', 'places', 'communities'), která má být aktivní
 * @param {boolean} [displayOnlyActivities=false] - Pokud true, zobrazí se pouze tab a obsah pro aktivity.
 */
export function displaySearchResults(query, results, listDisplayContainer, onItemClickCallback, initialSelectedTabKey = 'activities', displayOnlyActivities = false) {
    if (!listDisplayContainer) {
        console.error("Kontejner pro zobrazení seznamu výsledků nebyl poskytnut.");
        return;
    }

    listDisplayContainer.innerHTML = ''; // Vyčistíme předchozí obsah

    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'search-results-header-list';
    const resultsTitle = document.createElement('h3');
    resultsTitle.className = 'search-results-title-list-custom';

    if (displayOnlyActivities) {
        resultsTitle.textContent = `Aktivity pro: "${query}"`; // Nebo jen "Aktivity", pokud query je název kategorie
    } else {
        resultsTitle.textContent = (query === "Všechny položky" || !query) ? "Tipy v okolí:" : `Výsledky pro: "${query}"`;
    }
    resultsHeader.appendChild(resultsTitle);
    listDisplayContainer.appendChild(resultsHeader);

    const resultsTabsContainer = document.createElement('div');
    resultsTabsContainer.className = 'search-results-tabs-list';

    const tabTypesDefinition = [
        { name: 'Aktivity', key: 'activities', internalType: 'activity' },
        { name: 'Místa', key: 'places', internalType: 'place' },
        { name: 'Komunity', key: 'communities', internalType: 'community' }
    ];

    const activeTabTypes = displayOnlyActivities
        ? tabTypesDefinition.filter(tab => tab.key === 'activities')
        : tabTypesDefinition;

    const noMeaningfulResultsForPanel = activeTabTypes.every(tab => !results[tab.key] || results[tab.key].length === 0);

    if (noMeaningfulResultsForPanel) {
        const noResultsMsg = document.createElement('p');
        noResultsMsg.className = 'search-results-no-results-overall-list';
        noResultsMsg.textContent = (displayOnlyActivities)
            ? `Pro kategorii "${query}" nebyly nalezeny žádné aktivity.`
            : `Pro dotaz "${query}" nebyly nalezeny žádné položky k zobrazení.`;
        listDisplayContainer.appendChild(noResultsMsg);
        if (results && results.error) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'search-results-error-list komapka-error-message';
            errorMessage.textContent = results.error;
            listDisplayContainer.appendChild(errorMessage);
        }
        return;
    }

    const tabsContentContainer = document.createElement('div');
    tabsContentContainer.className = 'search-results-tabs-content-list';

    let currentActiveTabKey = initialSelectedTabKey;
    if (displayOnlyActivities) {
        currentActiveTabKey = 'activities';
    } else {
        if (!results[currentActiveTabKey] || results[currentActiveTabKey].length === 0) {
            const firstTabWithData = activeTabTypes.find(tab => results[tab.key] && results[tab.key].length > 0);
            currentActiveTabKey = firstTabWithData ? firstTabWithData.key : (activeTabTypes.length > 0 ? activeTabTypes[0].key : 'activities');
        }
    }

    activeTabTypes.forEach((tabInfo) => {
        let items = results[tabInfo.key];

        if (!displayOnlyActivities && (query === "Všechny položky" || !query) && tabInfo.key === 'activities') {
            // Pro "Tipy" můžeme omezit počet nebo filtrovat, např. na Prahu, jak bylo v původním kódu
            // items = items ? items.filter(item => item.adresa && item.adresa.toLowerCase().includes('praha')).slice(0, 5) : [];
            // Prozatím zobrazíme všechny aktivity pro "Tipy"
        }

        if (!displayOnlyActivities) {
            const tabElement = document.createElement('div');
            tabElement.className = 'search-results-tab-item';
            tabElement.textContent = `${tabInfo.name} (${(items || []).length})`; // Přidáme počet položek
            if (tabInfo.key === currentActiveTabKey) tabElement.classList.add('active');
            tabElement.setAttribute('data-tab-key', tabInfo.key);

            tabElement.addEventListener('click', () => {
                currentActiveTabKey = tabInfo.key;
                resultsTabsContainer.querySelectorAll('.search-results-tab-item').forEach(t => t.classList.remove('active'));
                tabElement.classList.add('active');
                tabsContentContainer.querySelectorAll('.search-results-tab-content-item').forEach(c => c.style.display = 'none');
                const activeContent = tabsContentContainer.querySelector(`#tab-content-${tabInfo.key}`);
                if (activeContent) activeContent.style.display = 'block';
            });
            resultsTabsContainer.appendChild(tabElement);
        }

        const tabContentElement = document.createElement('div');
        tabContentElement.className = 'search-results-tab-content-item';
        tabContentElement.style.display = (displayOnlyActivities || tabInfo.key === currentActiveTabKey) ? 'block' : 'none';
        tabContentElement.id = `tab-content-${tabInfo.key}`;

        if (items && items.length > 0) {
            items.forEach(item => {
                const resultItemElement = createResultItem(item, tabInfo.internalType, onItemClickCallback);
                tabContentElement.appendChild(resultItemElement);
            });
        } else {
            if (!displayOnlyActivities) {
                const noResultsMsg = document.createElement('p');
                noResultsMsg.className = 'search-results-no-results-list';
                noResultsMsg.textContent = `Nebyly nalezeny žádné ${tabInfo.name.toLowerCase()}.`;
                tabContentElement.appendChild(noResultsMsg);
            }
        }
        tabsContentContainer.appendChild(tabContentElement);
    });

    if (activeTabTypes.length > 0 && !displayOnlyActivities) {
        listDisplayContainer.appendChild(resultsTabsContainer);
    }
    listDisplayContainer.appendChild(tabsContentContainer);

    if (results && results.error) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'search-results-error-list komapka-error-message';
        errorMessage.textContent = results.error;
        listDisplayContainer.appendChild(errorMessage);
    }
}


/**
 * Vytvoření HTML elementu pro jednu položku v seznamu výsledků.
 * @param {Object} item - položka výsledku
 * @param {string} type - interní typ položky ('activity', 'place', 'community')
 * @param {Function} onItemClickCallback - callback po kliknutí (item, type) => {}
 * @returns {HTMLElement} - vytvořená položka výsledku
 */
function createResultItem(item, type, onItemClickCallback) {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item-list';
    resultItem.dataset.id = item.id || (item.nazev ? item.nazev.replace(/\s+/g, '-').toLowerCase() : `item-${Math.random().toString(36).substring(2, 11)}`);
    resultItem.dataset.type = type;

    let content = '';
    const title = item.nazev || (type === 'activity' ? 'Neznámá aktivita' : (type === 'place' ? 'Neznámé místo' : 'Neznámá komunita'));
    const category = item.kategorie || '';
    const description = item.popis ? (item.popis.length > 100 ? item.popis.substring(0, 97) + '...' : item.popis) : 'Popis není k dispozici.';
    const address = item.adresa || '';

    content = `
        <div class="result-item-header">
            <h4 class="result-item-title custom-item-title">${title}</h4>
            ${category ? `<span class="result-item-category">${category}</span>` : ''}
        </div>
        <div class="result-item-body">
            <p class="result-item-description">${description}</p>
            <div class="result-item-details">
    `;

    if (type === 'activity') {
        content += `${address ? `<span class="result-item-location">${address}</span>` : ''}`;
        content += `${item.zacatek ? `<span class="result-item-date">${formatDate(item.zacatek)}</span>` : ''}`;
    } else if (type === 'place') {
        content += `${address ? `<span class="result-item-location">${address}</span>` : ''}`;
        content += `${item.tagy && item.tagy.length ? `<span class="result-item-tags">${item.tagy.slice(0, 3).join(', ')}</span>` : ''}`;
    } else if (type === 'community') {
        const communityLocation = item.lokalita ? (item.lokalita.mesto || item.lokalita.region || '') : '';
        content += `${communityLocation ? `<span class="result-item-location">${communityLocation}</span>` : ''}`;
        content += `${item.pocet_clenu ? `<span class="result-item-members">${item.pocet_clenu} členů</span>` : ''}`;
    }

    content += `
            </div>
        </div>
    `;
    resultItem.innerHTML = content;

    resultItem.addEventListener('click', () => {
        if (onItemClickCallback) {
            onItemClickCallback(item, type);
        } else {
            console.log(`Kliknuto na položku (bez callbacku): ${item.nazev} (${type})`);
        }
    });

    return resultItem;
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Ověření, zda je datum validní
        if (isNaN(date.getTime())) {
            throw new Error("Invalid date value");
        }
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (error) {
        console.warn('Chyba při formátování data:', dateString, error);
        return dateString; // Vrátit původní string, pokud formátování selže
    }
}
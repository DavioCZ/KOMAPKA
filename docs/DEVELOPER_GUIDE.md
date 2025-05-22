# KOMAPKA - Vývojářská příručka

Vítejte ve vývojářské příručce pro projekt KOMAPKA! Tento dokument vám pomůže zorientovat se v kódu, pochopit jeho architekturu a efektivně přispívat k jeho vývoji.

## 1. Úvod

KOMAPKA je mapová webová aplikace navržená pro zobrazování aktivit, míst a komunit ve vašem okolí. Využívá Leaflet.js pro vykreslování mapy a nabízí vlastní vyhledávací funkcionalitu.

## 2. Nastavení projektu

### Předpoklady
- Nainstalovaný [Node.js](https://nodejs.org/) (který zahrnuje npm).

### Instalace
Projekt nemá přímé produkční závislosti v `package.json`, jelikož klientská část je postavena na vanilla JavaScriptu a knihovny jako Leaflet jsou načítány přes CDN. Pro vývoj je však použit `nodemon`.

1.  Naklonujte repozitář (pokud jste tak ještě neučinili).
2.  Přejděte do kořenového adresáře projektu.
3.  Nainstalujte vývojové závislosti:
    ```bash
    npm install
    ```

### Spuštění aplikace
-   **Vývojový režim** (s automatickým restartem serveru při změnách):
    ```bash
    npm run dev
    ```
    Server poběží na `http://localhost:3000` (nebo na portu definovaném v `process.env.PORT`).

-   **Produkční režim**:
    ```bash
    npm start
    ```

## 3. Struktura projektu

```
KOMAPKA/
├── api/                  # (Pravděpodobně pro budoucí API, aktuálně nevyužito)
├── config/               # Konfigurační soubory (např. config.js)
│   └── config.js
├── data/                 # Datové soubory JSON
│   ├── komunity/         # Data pro komunity
│   ├── mista/            # Data pro místa
│   ├── akce_001.json     # Příklad datového souboru pro akce
│   ├── ...
│   └── manifest.json     # Manifest definující datové soubory a datum poslední aktualizace
├── docs/                 # Dokumentace
│   ├── DEVELOPER_GUIDE.md # Tato příručka
│   └── ...
├── public/               # Veřejně přístupné soubory (klient)
│   ├── index.html        # Hlavní HTML stránka
│   └── 404.html
├── server/               # Serverová logika
│   └── server.js         # Hlavní soubor Node.js serveru
├── src/                  # Zdrojové kódy klienta
│   ├── assets/           # Ikony, obrázky
│   ├── components/       # UI komponenty (JavaScript)
│   │   ├── mapComponents.js
│   │   └── searchComponents.js
│   ├── css/              # Styly CSS
│   │   ├── search.css
│   │   └── styles.css
│   ├── js/               # Hlavní JavaScript logika klienta
│   │   ├── map.js
│   │   └── search.js
│   ├── services/         # Služby (např. pro API, vyhledávání)
│   │   ├── api.js
│   │   └── search/
│   │       ├── searchAPI.js
│   │       └── searchService.js
│   └── utils/            # Pomocné utility
│       ├── cacheUtils.js
│       └── mapUtils.js
├── .gitignore
├── package.json
├── README.md             # Obecné README projektu
└── zaloha_YYYYMMDD_HHMM/ # Zálohy projektu
```

## 4. Klíčové architektonické koncepty

-   **Silně klientská architektura**: Většina logiky aplikace (vykreslování mapy, interakce, vyhledávání, filtrování dat) probíhá v prohlížeči klienta.
-   **Jednoduchý Node.js server**: Server (`server/server.js`) má primárně za úkol servírovat statické soubory (HTML, CSS, JS, JSON). Neposkytuje komplexní API ani neukládá stav.
-   **Tok dat pro vyhledávání**:
    1.  Uživatel zadá dotaz do UI (`searchComponents.js`).
    2.  UI komponenta volá `search.js`.
    3.  `search.js` volá metody z `searchAPI.js`.
    4.  `searchAPI.js` deleguje požadavek na `searchService.js`.
    5.  `searchService.js` načte (pokud je potřeba) a zpracuje data z JSON souborů (definovaných v `data/manifest.json`), provede filtrování, skórování a vrátí výsledky zpět.
    6.  Výsledky jsou zobrazeny v UI (na mapě a v informačním panelu).
-   **Leaflet.js**: Knihovna pro interaktivní mapy. Používá se pro zobrazení mapového podkladu a markerů.
-   **Leaflet.markercluster**: Plugin pro Leaflet pro shlukování velkého množství markerů na mapě.

## 5. Práce s daty (`data/` adresář)

Všechna data pro aktivity, místa a komunity jsou uložena v JSON souborech v adresáři `data/`.

### `manifest.json`
-   Tento soubor je klíčový pro načítání dat. Definuje, které JSON soubory patří k jakému typu dat (aktivity, místa, komunity).
-   Obsahuje pole `files` pro každý typ dat, kde jsou uvedeny cesty k jednotlivým JSON souborům (relativně k adresáři `data/`).
-   Obsahuje pole `lastUpdated` (formát `YYYY-MM-DD`), které `searchService.js` používá k ověření, zda je potřeba znovu načíst data, nebo zda jsou data v cache aktuální.
    -   **DŮLEŽITÉ**: Při jakékoli změně v datových souborech JSON **musíte aktualizovat hodnotu `lastUpdated` v `manifest.json`**, aby se změny projevily v aplikaci (jinak bude služba používat zastaralá data z cache).

### Struktura datových JSON souborů
-   Každý soubor obsahuje buď pole objektů, nebo jeden objekt.
-   Každý objekt by měl mít konzistentní strukturu polí relevantních pro daný typ (např. `nazev`, `popis`, `latitude`, `longitude`, `kategorie`, `adresa` atd.).
-   Pro správné fungování vyhledávání a zobrazení na mapě jsou klíčové souřadnice (`latitude`, `longitude`).

### Přidání/úprava dat
1.  Upravte existující JSON soubor nebo přidejte nový do příslušného podadresáře (`data/akce/`, `data/mista/`, `data/komunity/`) nebo přímo do `data/`.
2.  Pokud přidáváte nový soubor, ujistěte se, že je uveden v poli `files` v `data/manifest.json` pod správným typem.
3.  **Aktualizujte `lastUpdated` v `data/manifest.json`** na aktuální datum.

## 6. Frontendový vývoj (`public/` a `src/`)

### `public/index.html`
-   Hlavní HTML soubor.
-   Inicializuje Leaflet mapu.
-   Načítá CSS styly a JavaScriptové soubory.
-   Definuje základní strukturu DOM (kontejner pro mapu, informační panel, kontejner pro vyhledávací lištu).
-   Obsahuje inline skript pro základní inicializaci mapy a načtení počátečních dat událostí (před implementací plného vyhledávacího systému).

### `src/js/search.js`
-   Centrální soubor pro logiku vyhledávání a interakci s mapou na straně klienta.
-   `initSearch(mapInstance)`: Inicializuje celý vyhledávací systém, vytváří UI komponenty, nastavuje listenery.
-   `handleSearchCallback(query, suggestionData)`: Zpracovává vstup z vyhledávacího pole (přímé hledání nebo výběr z návrhů).
-   `performGenericSearch(query)`: Provádí obecné textové vyhledávání.
-   `renderGeneralSearchResults(...)`: Zobrazuje výsledky obecného vyhledávání na mapě a v panelu.
-   `displaySingleItemOnMapAndInPanel(...)`: Zobrazuje detail jedné vybrané položky.
-   `createAndAddMarkerToMap(...)`: Vytváří a přidává markery na mapu.
-   Obsluhuje interakce s informačním panelem.
-   Obsluhuje tlačítko "Vyhledat v této oblasti".
-   Exportuje `searchByGeolocation` pro vyhledávání podle polohy.

### `src/components/searchComponents.js`
-   Obsahuje funkce pro vytváření a správu UI komponent pro vyhledávání.
-   `createSearchField(container, onSearch)`: Vytváří vyhledávací input s tlačítkem a kontejnerem pro návrhy. `onSearch` je callback funkce (typicky `handleSearchCallback` z `search.js`).
-   `showSuggestions(...)`, `hideSuggestions(...)`: Zobrazují a skrývají seznam návrhů na základě vstupu uživatele. Komunikují se `searchAPI.getSuggestions`.
-   `displaySearchResultsList(query, results, container, onItemClick, initialTab)`: Vykresluje seznam výsledků vyhledávání do poskytnutého kontejneru (typicky informační panel). Zahrnuje záložky pro různé typy výsledků (aktivity, místa, komunity). `onItemClick` je callback pro kliknutí na položku v seznamu.
-   `createResultItem(...)`: Generuje HTML pro jednotlivou položku v seznamu výsledků.

### `src/css/`
-   `styles.css`: Obecné styly pro aplikaci.
-   `search.css`: Styly specifické pro vyhledávací komponenty.

## 7. Funkcionalita vyhledávání (`src/services/search/`)

### `searchService.js`
-   Jádro vyhledávací logiky. Je to singleton instance třídy `SearchService`.
-   `initialize()`: Asynchronně načítá data z JSON souborů definovaných v `manifest.json`. Kontroluje `lastUpdated` pro možnost využití cache.
-   `loadDataFromFiles(files, type)`: Pomocná funkce pro načtení dat z více souborů.
-   `search(query, options)`: Hlavní vyhledávací metoda.
    -   Zpracovává textový `query`.
    -   Podporuje `options` jako `bounds` (pro vyhledávání v aktuálním výřezu mapy) nebo `location` (`{lat, lng, radius}`).
    -   Používá `normalizeQuery` pro normalizaci textu (diakritika, malá písmena).
    -   Používá `extractLocation` pro pokus o identifikaci lokality v dotazu.
    -   Filtruje data a volá `calculateScore` pro ohodnocení relevance.
    -   Výsledky cachuje pomocí `searchCache`.
-   `searchByLocation(lat, lng, radius, options)`: Specializovaná metoda pro vyhledávání v okruhu.
-   `calculateScore(item, queryWords)`: Vypočítává skóre relevance položky na základě shody v polích jako `nazev`, `kategorie`, `tagy`, `popis`. Váhy a faktory pro přesnou shodu/začátek slova jsou zde definovány.
-   `normalizeQuery(query)`: Standardizuje textové řetězce pro konzistentní porovnávání.
-   `extractLocation(normalizedFullQuery)`: Pokouší se z dotazu extrahovat známé lokality (definované v `this.knownGeocodedLocations`).
-   `performGeocode(locationName)`: Jednoduché "geokódování" na základě `this.knownGeocodedLocations`. Vrací souřadnice a hranice pro známé názvy lokalit.
-   `getSuggestions(query, options)`: Generuje návrhy pro našeptávač na základě shody v názvech položek.
-   **Cache**: Používá `Map` objekt (`searchCache`) pro ukládání výsledků vyhledávání na omezenou dobu (`CACHE_EXPIRATION`). Klíč cache je generován na základě dotazu a options.

### `searchAPI.js`
-   Funguje jako fasáda (rozhraní) k `searchService.js`.
-   Poskytuje metody (`search`, `getSuggestions`, `searchByLocation`, `geocodeLocation`), které jsou volány z UI vrstvy (`search.js`, `searchComponents.js`).
-   Zajišťuje, že `searchService.initialize()` je zavolána před provedením jakékoli operace.
-   Zpracovává případné chyby ze `searchService` a vrací je v konzistentním formátu.

## 8. Serverová část (`server/server.js`)

-   Velmi jednoduchý HTTP server postavený na modulu `http` z Node.js.
-   Hlavní účel: servírovat statické soubory z adresářů `public/`, `data/` a `src/`.
-   Nastavuje MIME typy pro různé přípony souborů.
-   Nastavuje HTTP hlavičky pro zakázání cachování na straně klienta (`Cache-Control: no-cache`).
-   Obsluhuje základní routing (např. `/` mapuje na `public/index.html`) a vrací `public/404.html` pro nenalezené soubory.
-   Pro běžný vývoj funkcionality aplikace není obvykle potřeba tento soubor upravovat, pokud se nemění způsob servírování souborů nebo základní konfigurace serveru.

## 9. Vývojový postup

1.  **Spusťte vývojový server**: `npm run dev`.
2.  **Proveďte změny v kódu**:
    -   Pro změny na serveru (`server/server.js`): `nodemon` automaticky restartuje server.
    -   Pro změny na klientovi (`src/`, `public/`): Obnovte stránku v prohlížeči (Ctrl+R nebo Cmd+R).
3.  **Testujte v prohlížeči**.
4.  **Využívejte vývojářské nástroje prohlížeče**:
    -   **Konzole**: Sledujte logy (`console.log`, `console.warn`, `console.error`), které jsou v kódu hojně využívány pro ladění.
    -   **Debugger**: Krokování kódu, inspekce proměnných.
    -   **Network**: Sledování HTTP požadavků (např. načítání datových JSON souborů).
    -   **Elements/Inspector**: Prohlížení a úprava DOM a CSS.

## 10. Konvence a doporučení

-   **Vanilla JavaScript (ES6+ Modules)**: Klientská část je psána v moderním JavaScriptu s využitím modulů.
-   **Komentáře**: Kód obsahuje poměrně dost komentářů. Snažte se v tomto trendu pokračovat a dokumentovat novou nebo složitější logiku.
-   **Oddělení zodpovědností (Separation of Concerns)**: Snažte se dodržovat rozdělení logiky mezi UI komponenty, hlavní aplikační logiku a služby.
-   **Normalizace řetězců**: Pro vyhledávání a porovnávání textů se používá `normalizeQuery` (odstranění diakritiky, malá písmena). Používejte ji konzistentně.
-   **Konfigurace**: Některé konfigurovatelné hodnoty (např. `CACHE_EXPIRATION`, váhy pro skórování) jsou přímo v kódu (`searchService.js`). Pro větší flexibilitu by mohly být přesunuty do `config/config.js`.

## 11. Možná budoucí vylepšení

-   **Robustnější geokódování**: Nahradit jednoduché geokódování založené na `knownGeocodedLocations` za volání externí geokódovací služby (např. Nominatim API, pokud to licence dovoluje).
-   **Pokročilé filtrování**: Přidat do UI možnosti filtrování výsledků podle kategorií, tagů, data atd.
-   **Optimalizace výkonu**: Pro velmi velké datové sady by mohlo být načítání všech dat do paměti klienta neefektivní. Zvážit server-side vyhledávání nebo pokročilejší techniky indexace na klientovi (např. s Web Workers a knihovnami jako Lunr.js).
-   **Uživatelské účty a personalizace**: (Vyžadovalo by značné rozšíření backendu).
-   **Testování**: Doplnit jednotkové a integrační testy.

Doufáme, že vám tato příručka pomůže! Hodně štěstí s vývojem KOMAPKY.

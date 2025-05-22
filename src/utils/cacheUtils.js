/**
 * Utility funkce pro správu cache
 */

/**
 * Generuje unikátní verzi pro soubory na základě aktuálního času
 * Toto zajistí, že prohlížeč vždy načte nejnovější verzi souboru
 * @returns {string} - Řetězec s verzí (timestamp)
 */
export function generateVersion() {
    return `v=${Date.now()}`;
}

/**
 * Přidá verzi k URL souboru
 * @param {string} url - URL souboru
 * @returns {string} - URL s přidanou verzí
 */
export function addVersionToUrl(url) {
    const version = generateVersion();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${version}`;
}

/**
 * Dynamicky načte JavaScript soubor s verzí
 * @param {string} url - URL souboru
 * @returns {Promise} - Promise, který se vyřeší po načtení souboru
 */
export function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = addVersionToUrl(url);
        script.type = 'module';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Dynamicky načte CSS soubor s verzí
 * @param {string} url - URL souboru
 * @returns {Promise} - Promise, který se vyřeší po načtení souboru
 */
export function loadStylesheet(url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.href = addVersionToUrl(url);
        link.rel = 'stylesheet';
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

/**
 * Nastaví hlavičky pro zakázání cache
 * Toto je užitečné pro vývojové prostředí
 */
export function disableCache() {
    // Přidání meta tagů pro zakázání cache
    const metaTags = [
        { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
        { httpEquiv: 'Pragma', content: 'no-cache' },
        { httpEquiv: 'Expires', content: '0' }
    ];
    
    metaTags.forEach(meta => {
        const metaTag = document.createElement('meta');
        metaTag.httpEquiv = meta.httpEquiv;
        metaTag.content = meta.content;
        document.head.appendChild(metaTag);
    });
    
    // Přidání posluchače události pro obnovení stránky při změně souboru
    // Toto je užitečné při použití Live Server
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Vývojové prostředí detekováno - cache zakázána');
        
        // Přidání query parametru s časem do URL pro vynucení obnovení
        window.addEventListener('focus', () => {
            const currentUrl = window.location.href;
            const urlWithoutTimestamp = currentUrl.split('?t=')[0];
            const newUrl = `${urlWithoutTimestamp}?t=${Date.now()}`;
            
            // Kontrola, zda se URL změnila
            if (currentUrl !== newUrl) {
                window.location.href = newUrl;
            }
        });
    }
}

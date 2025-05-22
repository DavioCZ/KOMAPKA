/**
 * Jednoduchý HTTP server pro spuštění aplikace KOMAPKA
 * Tento server nastavuje správné hlavičky pro zakázání cache
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Cesta k veřejným souborům a datům
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, '..', 'data');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Konfigurace serveru
const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf'
};

// Vytvoření serveru
const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    // Získání cesty k souboru
    let filePath = req.url;
    if (filePath === '/' || filePath === '') {
        filePath = '/index.html';
    }

    // Kontrola, zda jde o požadavek na data nebo zdrojové soubory
    let baseDir = PUBLIC_DIR;
    if (filePath.startsWith('/data/')) {
        baseDir = path.join(__dirname, '..');
        console.log(`Požadavek na data: ${filePath}, bude obsluhován z: ${baseDir}`);
    } else if (filePath.startsWith('/src/')) {
        baseDir = path.join(__dirname, '..');
        console.log(`Požadavek na zdrojový soubor: ${filePath}, bude obsluhován z: ${baseDir}`);
    }

    // Převod na absolutní cestu
    filePath = path.join(baseDir, filePath);

    // Získání přípony souboru
    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // Nastavení hlaviček pro zakázání cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Čtení souboru
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Soubor nenalezen
                const notFoundPath = path.join(PUBLIC_DIR, '404.html');
                fs.readFile(notFoundPath, (err, content) => {
                    if (err) {
                        // Pokud není ani 404.html, vrátíme jednoduchý text
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('404 Not Found');
                    } else {
                        // Vrátíme 404.html
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                // Jiná chyba serveru
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
                console.error(error);
            }
        } else {
            // Úspěšné načtení souboru
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Spuštění serveru
server.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
    console.log('Pro ukončení serveru stiskněte Ctrl+C');
});

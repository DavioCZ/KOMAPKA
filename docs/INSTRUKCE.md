# Instrukce pro spuštění aplikace KOMAPKA

## Spuštění pomocí Live Server

Nejjednodušší způsob, jak spustit aplikaci během vývoje, je použít rozšíření Live Server pro Visual Studio Code.

1. Nainstalujte rozšíření Live Server v VS Code
   - Otevřete VS Code
   - Klikněte na ikonu rozšíření v levém panelu (nebo stiskněte `Ctrl+Shift+X`)
   - Vyhledejte "Live Server"
   - Nainstalujte rozšíření od Ritwick Dey

2. Spuštění aplikace
   - Otevřete soubor `public/index.html`
   - Klikněte na tlačítko "Go Live" v pravém dolním rohu VS Code
   - Aplikace se automaticky otevře v prohlížeči

3. Výhody Live Server
   - Automatické obnovení stránky při změně souborů
   - Není potřeba manuálně obnovovat stránku
   - Funguje na všech platformách

## Spuštění pomocí Node.js serveru

Alternativně můžete použít jednoduchý Node.js server, který je součástí projektu.

1. Instalace závislostí
   ```
   npm install
   ```

2. Spuštění serveru
   ```
   npm start
   ```

3. Otevření aplikace
   - Otevřete prohlížeč a přejděte na adresu `http://localhost:3000`

4. Pro vývojový režim s automatickým obnovením
   ```
   npm run dev
   ```
   (Vyžaduje nainstalovaný nodemon: `npm install -g nodemon`)

## Poznámky k cache

Aplikace je nakonfigurována tak, aby prohlížeč nenačítal soubory z cache během vývoje. To zajišťuje, že vždy uvidíte nejnovější verzi aplikace.

Toto je zajištěno několika způsoby:

1. Meta tagy v HTML souboru
   ```html
   <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
   <meta http-equiv="Pragma" content="no-cache">
   <meta http-equiv="Expires" content="0">
   ```

2. Přidání verze k URL souborů
   ```html
   <link rel="stylesheet" href="../src/css/styles.css?v=1.0.0">
   <script type="module" src="../src/js/map.js?v=1.0.0"></script>
   ```

3. JavaScript kód pro zakázání cache
   ```javascript
   import { disableCache } from '../utils/cacheUtils.js';

   // Zakázání cache pro vývojové prostředí
   if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
       disableCache();
   }
   ```

4. Hlavičky serveru
   ```javascript
   res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
   res.setHeader('Pragma', 'no-cache');
   res.setHeader('Expires', '0');
   ```

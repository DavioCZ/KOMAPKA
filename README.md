# KOMAPKA

Mapová aplikace pro zobrazení aktivit a událostí ve vašem okolí.

## Popis projektu

KOMAPKA je webová aplikace, která zobrazuje mapový podklad na celou obrazovku a umožňuje uživatelům vyhledávat aktivity a události v jejich okolí. Aplikace získává data z externích zdrojů jako jsou GoOut a KudyZNudy.

## Struktura projektu

```
KOMAPKA/
├── api/                  # API skripty a endpointy
├── config/               # Konfigurační soubory
│   └── config.js         # Hlavní konfigurační soubor
├── docs/                 # Dokumentace
│   ├── INSTRUKCE.md      # Instrukce pro spuštění aplikace
│   ├── monetizace.pdf    # Dokumentace k monetizaci
│   └── planovani_app.pdf # Dokumentace k plánování aplikace
├── public/               # Veřejné soubory
│   ├── index.html        # Hlavní HTML soubor
│   └── 404.html          # Stránka pro chybu 404
├── server/               # Serverové skripty
│   └── server.js         # Hlavní server soubor
├── src/                  # Zdrojové soubory
│   ├── assets/           # Statické soubory
│   │   ├── icons/        # Ikony
│   │   └── images/       # Obrázky
│   ├── components/       # Komponenty
│   │   └── mapComponents.js # Komponenty pro mapu
│   ├── css/              # CSS styly
│   │   └── styles.css    # Hlavní CSS soubor
│   ├── js/               # JavaScript soubory
│   │   └── map.js        # Hlavní JS soubor pro mapu
│   ├── services/         # Služby pro komunikaci s API
│   │   └── api.js        # Služby pro GoOut a KudyZNudy
│   └── utils/            # Utility funkce
│       ├── cacheUtils.js # Utility pro správu cache
│       └── mapUtils.js   # Utility pro práci s mapou
├── .gitignore            # Soubor pro ignorování souborů v Gitu
├── package.json          # Konfigurace Node.js projektu
└── README.md             # Dokumentace projektu
```

## Funkce

- Zobrazení mapového podkladu na celou obrazovku
- Zjištění aktuální polohy uživatele
- Vyhledávání aktivit a událostí v okolí uživatele
- Filtrování aktivit podle kategorií
- Zobrazení detailů o aktivitách a událostech
- Odkazy na originální zdroje aktivit

## Použité technologie

- HTML5, CSS3, JavaScript (ES6+)
- Leaflet.js pro mapové podklady
- Moduly ES6 pro organizaci kódu
- OpenStreetMap jako mapový podklad

## Spuštění projektu

### Pomocí Live Server

Nejjednodušší způsob, jak spustit aplikaci během vývoje, je použít rozšíření Live Server pro Visual Studio Code.

1. Nainstalujte rozšíření Live Server v VS Code
2. Otevřete soubor `public/index.html`
3. Klikněte na tlačítko "Go Live" v pravém dolním rohu VS Code

### Pomocí Node.js serveru

Alternativně můžete použít jednoduchý Node.js server, který je součástí projektu.

1. Instalace závislostí
   ```
   npm install
   ```

2. Spuštění serveru
   ```
   npm start
   ```

3. Otevření aplikace v prohlížeči na adrese `http://localhost:3000`

Podrobnější instrukce najdete v souboru `docs/INSTRUKCE.md`.

## Plánované funkce

- Integrace s API GoOut
- Scraping dat z KudyZNudy
- Ukládání oblíbených aktivit
- Navigace k vybraným aktivitám
- Hodnocení aktivit

## Autor

Vytvořeno jako ukázkový projekt.

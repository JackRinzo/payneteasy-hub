# PaynetEasy Support Hub

Chrome extension + GitHub Pages tool registry using a thin shell architecture.

## Architecture

- Extension (`extension/`) is installed once and acts as a stable shell.
- Tools (`tools/`) are hosted on GitHub Pages and loaded dynamically each time `hub.html` opens.
- `extension/hub.js` fetches `tools/index.json`, renders tool tabs, fetches each tool UI/script, and executes tool logic in the active `payneteasy.eu` tab using `chrome.scripting.executeScript`.

## Project Structure

```text
payneteasy-hub/
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── hub.html
│   ├── hub.js
│   └── icons/
├── tools/
│   ├── index.json
│   ├── gate-renamer/
│   │   ├── tool.json
│   │   ├── tool.js
│   │   └── ui.html
│   └── log-extractor/
│       ├── tool.json
│       ├── tool.js
│       └── ui.html
└── README.md
```

## Setup

1. Create a GitHub repository (example: `payneteasy-hub`).
2. Push this project.
3. Enable GitHub Pages for the repository (branch: `main`, folder: `/ (root)`).
4. Update `REGISTRY_URL` in `extension/hub.js`:

```js
const REGISTRY_URL = "https://YOUR_GITHUB_USERNAME.github.io/payneteasy-hub/tools/index.json";
```

5. In Chrome, open `chrome://extensions`.
6. Enable **Developer mode**.
7. Click **Load unpacked** and select `payneteasy-hub/extension`.

## How It Works

- Click extension icon -> popup opens -> `hub.html` opens as a full tab.
- Hub finds the most recently active `https://*.payneteasy.eu/*` tab.
- Hub loads `tools/index.json` from GitHub Pages.
- Sidebar tabs are rendered from registry entries.
- Tool UI is fetched from each tool folder (`ui.html`).
- Tool script (`tool.js`) is fetched and executed on the target PaynetEasy tab.

## Existing Tools

- **Gate Renamer**: replaces chosen text in gate names inside Clone Project modal (all matches per row).
- **Log Extractor**: extracts merchant or processor log blocks and downloads `.txt`.

## Add New Tool Later

Only two steps:

1. Add a folder under `tools/` with:
   - `tool.js` (must define `run(params)`),
   - `ui.html`.
2. Add one entry in `tools/index.json`.

No extension reinstall required. Team sees updates on next hub open.

# Obsync Plugin

Obsidian plugin that connects to the Obsync backend for Mode A and Mode B sync.

## Setup
```
npm install
npm run dev
```

Copy the built artifacts into your vault:

```
plugin/dist/main.js
plugin/manifest.json
```

Target path in your vault:

```
.obsidian/plugins/obsync
```

## Settings
Configure in the Obsidian settings panel:
- Server URL
- Vault ID
- Auth mode (JWT or API key)
- Token or API key
- Heartbeat interval
- Debounce delay

## Build
```
npm run build
```

## Tests
```
npm test
```

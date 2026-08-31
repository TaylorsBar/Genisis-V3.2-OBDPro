# Genesis OS v3.2

Digital racedash, OBD-II telemetry (Web Bluetooth ELM327), dyno lab, and KC AI co-pilot.

**Status:** functional prototype — not certified diagnostics or production ECU tooling.

## Quick start

```bash
npm install
cp .env.example .env   # optional: GEMINI_API_KEY for AI features
npm run dev            # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle → `dist/` |
| `npm run preview` | Serve `dist/` via Vite |
| `npm start` | Express static server (serves `dist/` if present) |
| `npm run typecheck` | `tsc --noEmit` |

## Themes

Appearance → **Minimalist EV** is the Genesis Digital Racedash layout (live telemetry channels; SIM vs LIVE badge).

## OBD

Requires a browser with Web Bluetooth (Chrome/Edge on desktop/Android). Connect an ELM327-compatible adapter from the sidebar.

## Docker

```bash
docker build -t genesis-os .
docker run -p 8080:8080 genesis-os
```

## Honesty notes

- Hedera ledger UI is demo/mock until a real client is wired.
- EV SOC / power on the minimalist dash use OBD proxies until manufacturer EV PIDs are mapped.
- Gemini API key in the client bundle is a prototype compromise — move server-side before public deploy.

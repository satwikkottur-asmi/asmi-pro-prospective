# Asmi for Pros

Bilingual (en/es) waitlist landing page for home-service pros.

**Stack:** React 19 SPA on Vite · React Router · axios · Biome · deployed on Vercel

Frontend only: the waitlist API is an external backend (contract in [docs/api.md](docs/api.md)).

## Setup

```sh
npm install
cp .env.example .env   # set VITE_API_BASE_URL
pre-commit install     # Biome formatting on commit
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build → `dist/` (static) |
| `npm run preview` | Serve the production build |
| `npm run check` | Typecheck + lint + format check + tests |
| `npm run format` | Biome format + organize imports |
| `npm test` | Vitest (single file: `npx vitest run src/test/<file>`) |

## Project layout

```
src/
  main.tsx           entry: router + query client
  routes.tsx         routes (/, /join, 404) and error boundary
  components/asmi/   landing sections, signup flow, shared primitives
  lib/               app context, copy (dict.ts), API client (api.ts), stats
  config.ts          launch switches and domain keys
  styles.css         the single stylesheet (tokens → base → components → sections)
index.html           static meta/OG tags and fonts
vercel.json          SPA rewrite to index.html
docs/api.md          backend contract the frontend expects
```

## Launch notes

- Spanish copy needs native-speaker review before launch.
- Launch switches live in `src/config.ts`.
- Set `VITE_API_BASE_URL` in the Vercel project env (build-time). Signup API origin is `VITE_API_BASE_URL` (empty → same origin); paths live in `src/lib/api.ts`.
- Phone numbers are format-checked only; no SMS verification yet.

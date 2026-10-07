# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

- "Hoys for Pros" waitlist landing page for home-service pros (bilingual en/es)
- Plain Vite + React 19 SPA with React Router; static build deployed on Vercel
- Frontend only: waitlist API is an external backend (contract: `docs/backend_contracts.md`)
- Renamed from Asmi to Hoys. Logos: `src/assets/hoys-logo-blue.png` (site), full-size blue/black/white masters in `brand/`
- Formerly a Lovable + Supabase + TanStack Start (SSR) project; all removed

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (`dist/`)
- `npm run check` — typecheck + eslint + biome format check + vitest
- `npm run format` — Biome format + organize imports (also runs as a pre-commit hook via `.pre-commit-config.yaml`)
- Single test: `npx vitest run src/test/app-routing.test.tsx` (add `-t "<name>"` to filter)

## Architecture

- **Entry** — `index.html` (static meta/OG tags, fonts, hero preload) → `src/main.tsx` (QueryClient + `createBrowserRouter`)
- **Routing** — `src/routes.tsx` (React Router data routes); page/shell components in `src/components/hoys/pages.tsx`
  - `RootLayout`: feeds URL params to `AppProvider`, restores scroll; `RouteError` + `NotFound` render `StatusPage`
  - `/` → `Landing`, `/join` → standalone `SignupFlow`, `*` → 404
  - `vercel.json` rewrites every path to `index.html` so deep links work
  - Page `<title>` follows the language (`dict.meta.title`, set in `app-context.tsx`)
- **App state** — `src/lib/app-context.tsx`
  - URL params: `v` (a/b/c variant; `src=fb`→c, `src=door`→b), `lang`, `city` (`sf`/`la`/`ny`…), `ref`, `utm_*`
  - First-touch attribution in `sessionStorage` (`hoys_attr`) → sent with stage-1 signup
  - `track()` → `postEvent()` (no retries, keepalive)
- **API contract** — types in `src/lib/api-types.ts` (`API_PATHS`, per-stage request/response, `EventMeta`, `Stats`); prose in `docs/backend_contracts.md` — update both together
- **API client** — `src/lib/api.ts` (axios)
  - Base URL `VITE_API_BASE_URL` (required: `vite build` fails without it unless mocking; empty in dev → same origin)
  - `MOCK_API_CALL=true` (default false) → `src/lib/api-mock.ts` answers every call in the browser; exposed via `define` in `vite.config.ts` (mock dropped from builds when off)
  - Retries network/5xx with backoff; timeouts once (signup 25s, stats 20s: cold-start backend); 429 only with Retry-After ≤ 5s; 4xx never retried
  - `postSignup()` infers the response type from `body.stage`; resolves `{ ok: true, data }` or `{ ok: false, error? }` for any HTTP response; rejects only on network failure
  - `track()` is typed per event (`EventMeta`)
  - `getStats()` feeds `useStats()` (`src/lib/stats.ts`); counts stay hidden until thresholds in config
- **Signup flow** — one endpoint, staged by `body.stage`: `1` draft → `2` confirm (returns queue position) → `3` demo-call request; `"event"` = analytics
  - Phone: format-validated only (`libphonenumber-js`, US); no OTP/SMS verification
  - UI: `SignupFlow` (sheet + `/join`) inside a native `<dialog>` (`SignupSheet`); fields via `TextField`/`Choices`
- **Shared keys** — `src/config.ts` owns `CITY_KEYS`/`TRADE_KEYS`/`CREW_KEYS` (values sent to the API) + launch switches; `dict.ts` maps them to labels; `src/lib/validation.ts` holds form regexes
- **UI** — `src/components/hoys/`: `primitives.tsx` (`Plate`, `Section`, `CheckList`, `JoinCta`, `LiveLine`), `landing.tsx`, `signup.tsx`, `day-thread.tsx`, `company-proof.tsx`, `chrome.tsx` (`TopBar`, `Footer`, `PageShell`)
- **Styles** — `src/styles.css` only; Tailwind is used solely for its preflight reset (no utilities)
- **Images** — real files in `src/assets/`, imported as URLs (Vite hashes them)

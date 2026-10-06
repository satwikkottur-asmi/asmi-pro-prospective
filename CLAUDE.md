# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

- "Asmi for Pros" waitlist landing page for home-service pros (bilingual en/es)
- TanStack Start (React 19, SSR) on plain Vite; builds to a Cloudflare Worker via Nitro
- Frontend only: waitlist API is an external backend (contract: `docs/api.md`)
- Formerly a Lovable + Supabase project; both fully removed

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (`.output/`)
- `npm run check` — typecheck + eslint + biome format check + vitest
- `npm run format` — Biome format + organize imports (also runs as a pre-commit hook via `.pre-commit-config.yaml`)
- Single test: `npx vitest run src/test/waitlist-counts.test.ts` (add `-t "<name>"` to filter)

## Architecture

- **Routing** — file-based under `src/routes/` (see `src/routes/README.md`)
  - `__root.tsx`: head/fonts, `StatusPage` for 404 + error boundaries, wraps app in `AppProvider`
  - `index.tsx` (landing), `join.tsx` (standalone signup); shared head tags via `pageMeta()` in `src/lib/seo.ts`
  - `routeTree.gen.ts` is generated — never hand-edit
- **Server entry** — `src/server.ts` wraps the SSR handler with a static error page; `src/start.ts` adds error + CSRF middleware
- **App state** — `src/lib/app-context.tsx`
  - URL params: `v` (a/b/c variant; `src=fb`→c, `src=door`→b), `lang`, `city` (`sf`/`la`/`ny`…), `ref`, `utm_*`
  - First-touch attribution in `sessionStorage` (`asmi_attr`) → sent with stage-1 signup
  - `track()` → `postEvent()` (no retries, keepalive)
- **API client** — `src/lib/api.ts` (axios); contract in `docs/api.md` — update both together
  - Base URL `VITE_API_BASE_URL` (empty → same origin); paths are constants in api.ts
  - Retries network/timeout/5xx with backoff; 429 only with Retry-After; 4xx never retried
  - `postSignup()` resolves for any HTTP response (`ok=false` on 4xx/5xx); rejects only on network failure
  - `getStats()` feeds `useStats()` (`src/lib/stats.ts`); counts stay hidden until thresholds in config
- **Signup flow** — one endpoint, staged by `body.stage`: `1` draft → `2` confirm (returns queue position) → `3` demo-call request; `"event"` = analytics
  - Phone: format-validated only (`libphonenumber-js`, US); no OTP/SMS verification
  - UI: `SignupFlow` (sheet + `/join`) inside a native `<dialog>` (`SignupSheet`); fields via `TextField`/`Choices`
- **Shared keys** — `src/config.ts` owns `CITY_KEYS`/`TRADE_KEYS`/`CREW_KEYS` (values sent to the API) + launch switches; `dict.ts` maps them to labels; `src/lib/validation.ts` holds form regexes
- **UI** — `src/components/asmi/`: `primitives.tsx` (`Plate`, `Section`, `CheckList`, `JoinCta`, `LiveLine`), `landing.tsx`, `signup.tsx`, `day-thread.tsx`, `company-proof.tsx`, `chrome.tsx` (`TopBar`, `Footer`, `PageShell`)
- **Styles** — `src/styles.css` only; Tailwind is used solely for its preflight reset (no utilities)
- **Images** — real files in `src/assets/`, imported as URLs (Vite hashes them)

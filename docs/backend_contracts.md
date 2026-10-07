# Backend contracts — waitlist API

What the frontend expects from the waitlist backend.

- **Source of truth for shapes:** `src/lib/api-types.ts` (TypeScript). This doc is the prose version; change both together
- **Client:** `src/lib/api.ts` (axios, retries) · **Mock:** `src/lib/api-mock.ts` (`MOCK_API_CALL=true`)
- **Derived from:** the old Supabase server (`git show origin/main:src/lib/waitlist.server.ts`)

## Overview

| Method | Path | Purpose | Called from |
|---|---|---|---|
| `POST` | `/prospective/pro/signup/` | Signup stages `1` → `2` → `3`, plus analytics (`stage: "event"`) | `signup.tsx`, `app-context.tsx` (`track`) |
| `GET` | `/prospective/pro/stats/` | Public counters for the landing page | `stats.ts` (`useStats`) |
| `GET` | `/healthz/` | `200` + plain-text `OK` once the backend and database are ready | `main.tsx` (dev-only startup check via `checkHealth()`) |

- **Base URL:** `VITE_API_BASE_URL` (build-time). It's required in production, because the static Vercel deploy has no same-origin API
- **Paths:** `API_PATHS` in `api-types.ts` (Django). Keep the trailing slashes: without them POSTs fail, because Django can't redirect a POST
- **Local dev:** run the backend with `python manage.py runserver` and set `VITE_API_BASE_URL=http://localhost:8000` (scheme + port required). Check it's up: `curl http://localhost:8000/healthz/` → `OK` (the dev server also warns in the console if not)
- **Format:** JSON in, JSON out (`Content-Type: application/json`)
- **CORS:** if the API is on another origin, allow the site origin plus `Content-Type` (every POST is preflighted). Analytics use `fetch` with `keepalive`
- **Body limit:** ≤10 KB → else `413 too_large`; invalid JSON → `400 bad_json`

## Errors

Every failure is `{ "ok": false, "error": "<code>" }` with a 4xx/5xx status.

| Code | Status | When | Frontend shows |
|---|---|---|---|
| `phone` | 400 | Not a valid US mobile number | "That number does not look right." on the phone field |
| `name` · `city` · `service_city` · `consent` | 400 | Stage-1 validation | Generic "try again" (the frontend validates these first) |
| `zip` · `email` | 400 | Stage-2 validation | Generic "try again" |
| `token` | 400 / 404 | Malformed (not a UUID) / unknown token | Generic "try again" |
| `stage` | 400 | Unknown `stage` | — |
| `rate_limited` | 429 | Too many requests from this IP | Generic "try again" |
| `too_large` · `bad_json` | 413 / 400 | Bad body | — |
| `server` | 500 | Anything else | Generic "try again" |

**Client retry behavior (`api.ts`)**
- Retries network errors, timeouts (10 s) and 5xx: up to 3×, exponential backoff
- 429 is retried **only** if `Retry-After` (seconds) is sent → keep it short (a few seconds) or omit it
- 4xx is never retried
- Analytics events are never retried
- ⇒ **Stages 1–3 must be idempotent:** the same request can arrive twice if a response is lost

## `POST /prospective/pro/signup/` — stage 1: create draft

Sent when the user submits name, phone and city.

```json
{
  "stage": 1,
  "name": "Ana Ramos",
  "phone": "(415) 555-0123",
  "city": "bay_area",
  "service_city": "",
  "consent": true,
  "consent_text": "Hoys can text or call me about the waitlist.",
  "lang": "en",
  "variant": "a",
  "hp": "",
  "attribution": {
    "src": "fb", "v": "c", "city": "sf", "ref": "AB12CD34",
    "utm_source": "…", "utm_medium": "…", "utm_campaign": "…", "utm_content": "…", "utm_term": "…",
    "referrer": "https://…"
  }
}
```

| Field | Type | Rule |
|---|---|---|
| `name` | string | Required, trim, ≤80 → else `name` |
| `phone` | string | As typed. Must parse as a valid **US** number → else `phone`. Store as E.164 |
| `city` | `bay_area` \| `los_angeles` \| `new_york` \| `other` | → else `city` |
| `service_city` | string | Required (≤100) when `city` is `other` → else `service_city`; ignored otherwise |
| `consent` | `true` | Must be literally `true` → else `consent`. Store with timestamp |
| `consent_text` | string | Exact consent copy shown, in the page language (≤600). Store as-is |
| `lang` | `en` \| `es` | Anything else → `en` |
| `variant` | `a` \| `b` \| `c` | Landing-page A/B variant (≤4) |
| `hp` | string | Honeypot. **Non-empty → bot:** return `200 { ok: true, token: null, ref_code: null, city }` and store nothing |
| `attribution` | object, all keys optional | First-touch URL params. Values ≤100 (`ref` ≤16, `src` ≤40, `referrer` ≤300). Stored **on insert only** |

**Response 200**

```json
{ "ok": true, "token": "6f1c…-uuid", "ref_code": "AB12CD34", "city": "bay_area" }
```

- `token`: UUID, the edit token for stages 2 and 3 (null only for honeypot hits)
- `ref_code`: 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The frontend builds the share link `<site>/?ref=<ref_code>` from it
- **Upsert by phone (E.164):** an existing number updates its fields and keeps its `token`/`ref_code`; a new number generates both
- Also store: `user_agent` (≤300), `src`, the `utm_*` fields and `referrer` from attribution; `referred_by` = `attribution.ref`
- Rate limit: 10 signup requests per IP per 10 min → `429 rate_limited`

## `POST /prospective/pro/signup/` — stage 2: confirm

Sent from the "one last step" form. This is what actually puts someone on the list.

```json
{
  "stage": 2,
  "token": "6f1c…-uuid",
  "trades": ["hvac", "plumbing"],
  "trade_other": "",
  "crew_size": "2_5",
  "zip": "94110",
  "business_name": "Ramos HVAC",
  "email": "ana@example.com"
}
```

| Field | Type | Rule |
|---|---|---|
| `token` | UUID | Malformed → `400 token`; unknown → `404 token` |
| `trades` | `TradeKey[]` | Subset of `plumbing, electrical, hvac, handyman, roofing, general_contractor, cleaning, other`; drop unknown values. May be empty |
| `trade_other` | string | Store (≤60) only when `trades` includes `other` |
| `crew_size` | `just_me` \| `2_5` \| `6_10` \| `10_plus` \| `null` | Unknown → `null` |
| `zip` | string | `""` or exactly 5 digits → else `zip` |
| `business_name` | string | Optional, ≤120 |
| `email` | string | `""` or valid email (≤200) → else `email` |

**Response 200**

```json
{ "ok": true, "position": 669, "city_position": 258 }
```

- Set `confirmed_at` **only the first time** (re-sends are idempotent; return the same positions)
- On that first confirm, if `referred_by` matches a **confirmed** row's `ref_code` → that referrer gets `referral_count + 1` (never yourself)
- `position` (required): place on the **overall** waitlist, all cities. How it's computed is up to the backend
- `city_position` (**requested, optional**): place among rows with the **same `city`**. Send `null` or omit it until it's built; omit for `other`
- Done screen: big "#669 on the waitlist", then a smaller "#258 in Bay Area" only when `city_position` is present and the city isn't `other`

## `POST /prospective/pro/signup/` — stage 3: demo call request

Sent when the user taps "Yes, call me" on the done screen.

```json
{ "stage": 3, "token": "6f1c…-uuid", "demo_call_requested": true }
```

**Response 200:** `{ "ok": true }` · Unknown token → `404 token`. The frontend shows "Done" whatever the result.

## `POST /prospective/pro/signup/` — `stage: "event"` (analytics)

Fire-and-forget: `keepalive`, never retried, response ignored. Sent immediately per user action (no batching). One event per outcome: no paired or per-field events.

```json
{
  "stage": "event",
  "name": "cta_click",
  "session_id": "b0f3…-uuid",
  "variant": "a",
  "src": "fb",
  "lang": "en",
  "meta": { "source": "hero" }
}
```

- `session_id`: per-tab UUID (≤64) · `src`: `attribution.src` or `null` (≤40) · `name` ≤40
- **Response 200:** `{ "ok": true }`
- Rate limit: looser than signups (previously 120 per IP per 10 min)

| `name` | `meta` | Fired when |
|---|---|---|
| `page_view` | `{ path }` | Once per page load (in-site navigation doesn't resend) |
| `lang_switch` | `{ to: "en" \| "es" }` | Language actually changed (re-clicking the active one sends nothing) |
| `cta_click` | `{ source }` (`hero`, `final`) | "Join the waitlist" button; it also opens the signup sheet |
| `step1_error` | `{ fields: string[] }` | Once per failed step-1 submit: the invalid form fields, or `[<ErrorCode>]` / `["network"]` |
| `step1_success` | `{ city }` | Stage 1 accepted |
| `step2_submit` | `{ trades: <count>, crew }` | Step-2 submit pressed |
| `share_click` | `{ method: "share" \| "copy" }` | Share sheet opened, or link copied (also used when the share sheet isn't available) |
| `demo_request` | `{}` | "Yes, call me" |
| `thread_complete` | `{}` | The "day with Hoys" chat animation finished (first playthrough per page load) |

- Step-1 submits = `step1_success` + `step1_error`
- Removed: `sheet_open` (duplicated `cta_click`) and `step1_submit` (derivable)

## `GET /prospective/pro/stats/`

```json
{
  "total": 360,
  "remaining": 144,
  "cities": { "bay_area": 30, "los_angeles": 14, "new_york": 9, "other": 3 }
}
```

How these numbers are computed is up to the backend; the frontend shows them as sent.

| Field | Type | Where it shows |
|---|---|---|
| `total` | integer | Not displayed; only gates the per-city "spots left" line (`total ≥ 100`, `MIN_COUNT_TO_SHOW`) |
| `remaining` | integer ≥ 0 | "Only N spots left" under both "Join the waitlist" buttons. `0` → "This group is full" |
| `cities` | integer per city key | "N pros joined" on the Bay Area / Los Angeles / New York cards; also "N spots left in <city>" once `CITY_SPOTS` caps are set in `config.ts` (all `null` today) |

- Until stats load (or if the request fails), the spots line is hidden and city cards show the name only
- Send `Cache-Control: public, max-age=60, s-maxage=60`; errors → `503 { "error": "stats_unavailable" }`
- The frontend rejects responses without a numeric `total` (e.g. an HTML fallback page)
- `recent7d` / `recent` are no longer used; the backend can stop sending them (extra fields are ignored)
- `PROMO_COUNTER` (`config.ts`, off): when on, the shown number counts down from `remaining` on the client

## Side effects the old server had (decide before launch)

- **Google Sheets sync:** after each of stages 1, 2 and 3, the old server POSTed the full row to an Apps Script URL (`APPS_SCRIPT_URL` + `APPS_SCRIPT_SECRET`). If ops reads leads from that sheet, the new backend must keep doing this (as an upsert, not an append, because of retries)
- **Referral bump:** the old position formula subtracted `referral_count × REFERRAL_BUMP`. `REFERRAL_BUMP` is `0` and the UI hides the bump copy. If it's ever turned on, the backend must own the value and apply it to `position`
- **Existing data:** current signups live in the old Lovable Cloud Supabase project; migrate them before switching

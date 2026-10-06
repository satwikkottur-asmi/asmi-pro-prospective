# Waitlist API contract

What the frontend (`src/lib/api.ts`) expects from the backend. Derived from the previous Supabase implementation.

- Base URL: `VITE_API_BASE_URL`; paths are constants in `src/lib/api.ts`
- JSON in / JSON out; CORS must allow the site origin if the API is on another domain
- Error responses: `{ "ok": false, "error": "<code>" }` with a 4xx/5xx status
- Phone verification: none yet (format validation only)

## `POST /signup`

One endpoint; behavior depends on `stage`.

### `stage: 1` — create draft

Request:

```json
{
  "stage": 1,
  "name": "Ana Ramos",
  "phone": "(415) 555-0123",
  "city": "bay_area",
  "service_city": "",
  "consent": true,
  "consent_text": "Asmi can text or call me about the waitlist.",
  "lang": "en",
  "variant": "a",
  "hp": "",
  "attribution": { "src": "fb", "ref": "AB12CD34", "utm_source": "…", "referrer": "…" }
}
```

Response: `{ "ok": true, "token": "<uuid>", "ref_code": "AB12CD34", "city": "bay_area" }`

Rules:
- `hp` (honeypot) non-empty → return `ok: true` with null token/ref_code, store nothing
- `name` required (≤80) → else `400 name`
- `city` ∈ `bay_area | los_angeles | new_york | other` → else `400 city`
- `city: "other"` requires `service_city` (≤100) → else `400 service_city`
- `consent === true` → else `400 consent`
- `phone` must parse as a valid US number → else `400 phone` (frontend shows a phone-specific error); store as E.164
- Upsert by phone: existing number → update fields, keep its `ref_code`/token; new → generate both
- `attribution` (first-touch, stored on insert only): `src, ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer`; `ref` = referrer's `ref_code`
- Rate limit: 10 signup requests / IP / 10 min → `429 rate_limited` (send `Retry-After` if retries are welcome)

### `stage: 2` — confirm

Request: `{ "stage": 2, "token": "<uuid>", "trades": ["hvac"], "trade_other": "", "crew_size": "2_5", "zip": "94110", "business_name": "", "email": "" }`

Response: `{ "ok": true, "position": 305 }`

Rules:
- Unknown token → `404 token`
- `trades` ⊆ `plumbing | electrical | hvac | handyman | roofing | general_contractor | cleaning | other` (drop unknowns)
- `crew_size` ∈ `just_me | 2_5 | 6_10 | 10_plus` or null
- `zip` optional, 5 digits → else `400 zip`; `email` optional, valid → else `400 email`
- Set `confirmed_at` only the first time; on that first confirm, credit the referrer (`ref_code` = stored `ref`) with +1 referral if they are confirmed
- `position` = 304 (existing list) + number of confirmed rows with `confirmed_at` ≤ this row's, minimum 305

### `stage: 3` — demo call request

Request: `{ "stage": 3, "token": "<uuid>", "demo_call_requested": true }` → `{ "ok": true }` (unknown token → `404 token`)

### `stage: "event"` — analytics

Request: `{ "stage": "event", "name": "cta_click", "session_id": "<uuid>", "variant": "a", "src": null, "lang": "en", "meta": { … } }` → `{ "ok": true }`

- Fire-and-forget (sent with keepalive, never retried); looser rate limit (previously 120 / IP / 10 min)
- Events: `page_view`, `lang_switch`, `cta_click`, `sheet_open`, `step1_submit`, `step1_error`, `step1_success`, `step2_submit`, `share_click`, `demo_request`, `thread_complete`

## `GET /stats`

Response:

```json
{
  "total": 486,
  "remaining": 18,
  "cities": { "bay_area": 120, "los_angeles": 40, "new_york": 18, "other": 4 },
  "recent7d": 12,
  "recent": [{ "trade": "hvac", "place": "Oakland", "when": "today" }]
}
```

- Count confirmed rows only
- `total` = 304 + confirmed; `remaining` = max(0, 200 − confirmed)
- `recent`: up to 6 confirmed joins from the last 7 days, older than 15 min, newest first; `place` from zip prefix or metro name; `when` ∈ `today | yesterday | this week`
- Cacheable for 60s

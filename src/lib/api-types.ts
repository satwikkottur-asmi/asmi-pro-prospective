import type { CityKey, CrewKey, TradeKey } from "@/config";
import type { Lang, Variant } from "./dict";

// Waitlist API contract, frontend side. Prose version: docs/backend_contracts.md (keep in sync).
// - POST signup: one endpoint, behavior picked by `stage` (1 → 2 → 3, or "event")
// - GET stats: public counters for the landing page

// Django backend paths. Keep the trailing slashes: Django can't redirect a POST to the slashed URL.
export const API_PATHS = {
  signup: "/prospective/pro/signup/",
  stats: "/prospective/pro/stats/",
} as const;

// ── Shared ──────────────────────────────────────────────────────────────────

// Error codes the backend returns as `{ ok: false, error }` with a 4xx/5xx status.
export type ErrorCode =
  | "name"
  | "city"
  | "service_city"
  | "consent"
  | "phone"
  | "token"
  | "zip"
  | "email"
  | "stage"
  | "rate_limited"
  | "too_large"
  | "bad_json"
  | "server";

export type ApiError = { ok: false; error?: ErrorCode };

// First-touch URL params captured on landing (values ≤100 chars; referrer ≤300).
export const ATTR_KEYS = [
  "src",
  "v",
  "city",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type Attribution = Partial<Record<(typeof ATTR_KEYS)[number] | "referrer", string>>;

// ── POST signup, stage 1: create or update the draft ───────────────────────

export type Stage1Request = {
  stage: 1;
  name: string;
  phone: string; // as typed, e.g. "(415) 555-0123"; backend normalizes to E.164
  city: CityKey;
  service_city: string; // required when city is "other"
  consent: true;
  consent_text: string; // exact text shown, in the page language
  lang: Lang;
  variant: Variant;
  hp: string; // honeypot; non-empty → bot
  attribution: Attribution;
};
export type Stage1Response = {
  ok: true;
  token: string | null; // null only for honeypot hits
  ref_code: string | null;
  city: CityKey;
};

// ── POST signup, stage 2: confirm → queue position ─────────────────────────

export type Stage2Request = {
  stage: 2;
  token: string;
  trades: TradeKey[];
  trade_other: string; // used only when trades includes "other"
  crew_size: CrewKey | null;
  zip: string; // "" or 5 digits
  business_name: string;
  email: string; // "" or a valid email
};
export type Stage2Response = { ok: true; position: number };

// ── POST signup, stage 3: demo call request ────────────────────────────────

export type Stage3Request = { stage: 3; token: string; demo_call_requested: true };
export type Stage3Response = { ok: true };

// ── POST signup, stage "event": analytics ──────────────────────────────────

// Event name → its `meta` payload. One event per user outcome (no paired or per-field events).
export type EventMeta = {
  page_view: { path: string }; // once per page load
  lang_switch: { to: Lang };
  cta_click: { source: string }; // opens the signup sheet
  step1_error: { fields: string[] }; // once per failed submit: invalid form fields, or [ErrorCode | "network"]
  step1_success: { city: CityKey };
  step2_submit: { trades: number; crew: CrewKey | null };
  share_click: { method: "share" | "copy" }; // what actually ran (share sheet, or clipboard fallback)
  demo_request: Record<string, never>;
  thread_complete: Record<string, never>; // first playthrough per page load
};
export type EventName = keyof EventMeta;

export type EventRequest<N extends EventName = EventName> = {
  stage: "event";
  name: N;
  session_id: string; // per-tab UUID
  variant: Variant;
  src: string | null; // attribution.src
  lang: Lang;
  meta: EventMeta[N];
};
export type EventResponse = { ok: true };

// ── Stage → request/response map ───────────────────────────────────────────

export type SignupRequest = Stage1Request | Stage2Request | Stage3Request | EventRequest;
export type SignupResponses = {
  1: Stage1Response;
  2: Stage2Response;
  3: Stage3Response;
  event: EventResponse;
};
export type SignupResponseFor<R extends SignupRequest> = SignupResponses[R["stage"]];

// ── GET stats ───────────────────────────────────────────────────────────────

export type Stats = {
  total: number;
  remaining: number;
  cities: Record<CityKey, number>;
  recent7d: number;
  recent: { trade: TradeKey | null; place: string; when: "today" | "yesterday" | "this week" }[];
};

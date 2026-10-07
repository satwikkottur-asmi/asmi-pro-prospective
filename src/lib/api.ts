import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import {
  API_PATHS,
  type ErrorCode,
  type EventRequest,
  type SignupRequest,
  type SignupResponseFor,
  type Stats,
} from "./api-types";

// Waitlist backend client (types: ./api-types.ts, contract: docs/backend_contracts.md).
// - Base URL: VITE_API_BASE_URL (empty → same origin)
// - Retries: network errors, 5xx (up to 3×); timeouts once; 429 only with Retry-After ≤ 5s
// - 4xx validation errors are returned, never retried
// - Timeouts sized for a cold backend (15–20s on the first hit after idle):
//   signup 25s, stats 20s; a 2nd timeout means it's down, not waking → stop
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;
const MAX_RETRY_AFTER_MS = 5_000; // longer → surface the error instead of a minutes-long spinner
const SIGNUP_TIMEOUT_MS = 25_000;
const STATS_TIMEOUT_MS = 20_000;

declare module "axios" {
  interface AxiosRequestConfig {
    retries?: number;
    attempt?: number;
    timedOut?: boolean; // an earlier attempt timed out
  }
}

// Exported for tests (they swap `api.defaults.adapter`).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// MOCK_API_CALL=true (default false) → every request (incl. events' fetch adapter) is answered by src/lib/api-mock.ts.
// Dynamic import + literal flag (vite.config.ts `define`) → mock is dropped from builds when off.
if (import.meta.env.MOCK_API_CALL === "true") {
  api.interceptors.request.use((config) => {
    config.adapter = (c) => import("./api-mock").then((m) => m.mockAdapter(c));
    return config;
  });
}

function retryAfterMs(error: AxiosError) {
  const header = error.response?.headers["retry-after"];
  const seconds = Number(header);
  const ms = seconds * 1000;
  return Number.isFinite(ms) && ms > 0 && ms <= MAX_RETRY_AFTER_MS ? ms : null;
}

// ECONNABORTED: xhr/http adapters · ETIMEDOUT: fetch adapter / clarifyTimeoutError
const isTimeout = (error: AxiosError) =>
  error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";

function isRetryable(error: AxiosError) {
  const status = error.response?.status;
  if (isTimeout(error)) return !error.config?.timedOut;
  if (status == null) return error.code !== "ERR_CANCELED"; // network error
  if (status === 429) return retryAfterMs(error) != null;
  return status >= 500;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config;
  if (!config) throw error;
  const attempt = config.attempt ?? 0;
  if (attempt >= (config.retries ?? MAX_RETRIES) || !isRetryable(error)) throw error;
  const backoff = BASE_DELAY_MS * 2 ** attempt + Math.random() * BASE_DELAY_MS;
  await new Promise((resolve) => setTimeout(resolve, retryAfterMs(error) ?? backoff));
  return api.request({
    ...config,
    attempt: attempt + 1,
    timedOut: config.timedOut || isTimeout(error),
  });
});

// ok=true → typed success body; ok=false → backend error code when it sent one.
export type SignupResult<T> = { ok: true; data: T } | { ok: false; error?: ErrorCode | undefined };

const errorCode = (data: unknown) =>
  (data as { error?: ErrorCode } | undefined)?.error ?? undefined;

// Resolves for any HTTP response (ok=false on 4xx/5xx); rejects only when the request never landed.
export async function postSignup<R extends SignupRequest>(
  body: R,
  config: AxiosRequestConfig = {},
): Promise<SignupResult<SignupResponseFor<R>>> {
  try {
    const { data } = await api.post<SignupResponseFor<R>>(API_PATHS.signup, body, {
      timeout: SIGNUP_TIMEOUT_MS,
      ...config,
    });
    // A 2xx without `ok: true` (e.g. an HTML page) is not a success.
    return data?.ok === true ? { ok: true, data } : { ok: false, error: errorCode(data) };
  } catch (error) {
    const response = axios.isAxiosError(error) ? error.response : undefined;
    if (!response) throw error;
    return { ok: false, error: errorCode(response.data) };
  }
}

export async function getStats() {
  const { data } = await api.get<Stats>(API_PATHS.stats, { retries: 1, timeout: STATS_TIMEOUT_MS });
  // Guards against a 200 HTML fallback page or a partial body (missing `cities` would crash render).
  const valid =
    typeof data?.total === "number" &&
    typeof data.remaining === "number" &&
    typeof data.cities === "object" &&
    data.cities !== null;
  if (!valid) throw new Error("Unexpected stats response");
  return data;
}

// Backend + database ready? GET /healthz/ → 200 "OK". Never throws; meant to run in the background.
// - Up to 3 attempts (shared interceptor: backoff on network errors, 5xx; timeouts retried once)
// - 30s per attempt: a cold backend can take 15–20s on the first hit
export async function checkHealth(): Promise<boolean> {
  try {
    const { data } = await api.get<string>(API_PATHS.health, {
      retries: 2,
      timeout: 30_000,
      responseType: "text",
    });
    return String(data).trim() === "OK";
  } catch {
    return false;
  }
}

// Fire-and-forget analytics: no retries (avoid double counts), keepalive survives page unload.
// Default 10s timeout: nobody waits on it.
export function postEvent(body: EventRequest) {
  return postSignup(body, {
    retries: 0,
    timeout: 10_000,
    adapter: "fetch",
    fetchOptions: { keepalive: true },
  });
}

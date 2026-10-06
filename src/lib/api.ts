import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

// Waitlist backend client (contract: docs/api.md).
// - Base URL: VITE_API_BASE_URL (empty → same origin)
// - Retries: network errors, timeouts, 5xx; 429 only with Retry-After
// - 4xx validation errors are returned, never retried
// TODO: swap in the real paths once the backend is live.
const SIGNUP_PATH = "/api/public/signup";
const STATS_PATH = "/api/public/stats";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

declare module "axios" {
  interface AxiosRequestConfig {
    retries?: number;
    attempt?: number;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

function retryAfterMs(error: AxiosError) {
  const header = error.response?.headers["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function isRetryable(error: AxiosError) {
  const status = error.response?.status;
  if (status == null) return error.code !== "ERR_CANCELED"; // network error or timeout
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
  return api.request({ ...config, attempt: attempt + 1 });
});

type SignupResult<T> = { ok: boolean; data: T & { ok?: boolean; error?: string } };

// Resolves for any HTTP response (ok=false on 4xx/5xx); rejects only when the request never landed.
export async function postSignup<T = Record<string, unknown>>(
  body: unknown,
  config: AxiosRequestConfig = {},
): Promise<SignupResult<T>> {
  try {
    const { data } = await api.post<SignupResult<T>["data"]>(SIGNUP_PATH, body, config);
    return { ok: !!data?.ok, data: data ?? ({} as SignupResult<T>["data"]) };
  } catch (error) {
    const response = axios.isAxiosError(error) ? error.response : undefined;
    if (!response) throw error;
    return { ok: false, data: (response.data ?? {}) as SignupResult<T>["data"] };
  }
}

export async function getStats<T>() {
  const { data } = await api.get<T>(STATS_PATH, { retries: 1 });
  return data;
}

// Fire-and-forget analytics: no retries (avoid double counts), keepalive survives page unload.
export function postEvent(body: unknown) {
  return postSignup(body, { retries: 0, adapter: "fetch", fetchOptions: { keepalive: true } });
}

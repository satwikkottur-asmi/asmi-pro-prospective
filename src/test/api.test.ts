import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type RawAxiosResponseHeaders,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getStats, postEvent, postSignup } from "@/lib/api";
import type { Stage3Request } from "@/lib/api-types";

// Fake transport: each call takes the next scripted reply (last one repeats).
// - status → HTTP response with that body · "network" → no response · "timeout" → axios timeout
// - calls(config) records each attempt's config (e.g. its timeout)
type Reply =
  | { status: number; data?: unknown; headers?: RawAxiosResponseHeaders }
  | "network"
  | "timeout";

function script(...replies: Reply[]) {
  const calls = vi.fn();
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls(config);
    const reply = replies[Math.min(calls.mock.calls.length - 1, replies.length - 1)]!;
    if (reply === "network") throw new AxiosError("Network Error", "ERR_NETWORK", config);
    if (reply === "timeout") throw new AxiosError("timeout", "ECONNABORTED", config);
    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: String(reply.status),
      headers: reply.headers ?? {},
      config,
    };
    if (reply.status >= 400)
      throw new AxiosError("fail", "ERR_BAD_RESPONSE", config, null, response);
    return response;
  };
  return calls;
}

// Runs the request while flushing retry backoff timers.
async function settle<T>(promise: Promise<T>) {
  const caught = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  return caught;
}

const STAGE3: Stage3Request = { stage: 3, token: "t", demo_call_requested: true };
const originalAdapter = api.defaults.adapter!;
const originalBaseURL = api.defaults.baseURL ?? "";

beforeEach(() => {
  vi.useFakeTimers();
  // Absolute base whatever .env says: the fetch adapter can't build a request from a relative URL.
  api.defaults.baseURL = "http://api.test";
});
afterEach(() => {
  vi.useRealTimers();
  api.defaults.baseURL = originalBaseURL;
  vi.unstubAllGlobals();
  api.defaults.adapter = originalAdapter;
});

describe("postSignup", () => {
  it("returns data on a 2xx with ok: true", async () => {
    script({ status: 200, data: { ok: true } });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: true, data: { ok: true } } });
  });

  it("treats a 2xx HTML page as a failure", async () => {
    script({ status: 200, data: "<!doctype html>" });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: false, error: undefined } });
  });

  it("returns the 4xx error code without retrying", async () => {
    const calls = script({ status: 400, data: { ok: false, error: "phone" } });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: false, error: "phone" } });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx 3 times, then returns ok: false", async () => {
    const calls = script({ status: 503 });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: false, error: undefined } });
    expect(calls).toHaveBeenCalledTimes(4);
  });

  it("recovers when a retry succeeds", async () => {
    const calls = script({ status: 502 }, { status: 200, data: { ok: true } });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: true, data: { ok: true } } });
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("retries 429 only with a short Retry-After", async () => {
    const rateLimited = (retryAfter?: string) => ({
      status: 429,
      data: { ok: false, error: "rate_limited" },
      headers: retryAfter ? { "retry-after": retryAfter } : {},
    });

    let calls = script(rateLimited("1"), { status: 200, data: { ok: true } });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: true, data: { ok: true } } });
    expect(calls).toHaveBeenCalledTimes(2);

    calls = script(rateLimited("600")); // over the 5s cap → surfaced, not waited out
    expect(await settle(postSignup(STAGE3))).toEqual({
      value: { ok: false, error: "rate_limited" },
    });
    expect(calls).toHaveBeenCalledTimes(1);

    calls = script(rateLimited());
    await settle(postSignup(STAGE3));
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("rejects after retrying network errors", async () => {
    const calls = script("network");
    const result = await settle(postSignup(STAGE3));
    expect(result).toHaveProperty("error");
    expect(calls).toHaveBeenCalledTimes(4);
  });
});

describe("cold-start timeouts", () => {
  const sentTimeout = (calls: ReturnType<typeof script>) =>
    (calls.mock.calls[0]![0] as InternalAxiosRequestConfig).timeout;

  it("gives signups 25s and stats 20s per attempt", async () => {
    let calls = script({ status: 200, data: { ok: true } });
    await settle(postSignup(STAGE3));
    expect(sentTimeout(calls)).toBe(25_000);

    calls = script({ status: 200, data: { total: 1, remaining: 1, cities: {} } });
    await settle(getStats());
    expect(sentTimeout(calls)).toBe(20_000);
  });

  it("retries a timeout once, and succeeds once the backend is warm", async () => {
    const calls = script("timeout", { status: 200, data: { ok: true } });
    expect(await settle(postSignup(STAGE3))).toEqual({ value: { ok: true, data: { ok: true } } });
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("stops after a second timeout, even with retries left", async () => {
    const calls = script("timeout", { status: 503 }, "timeout");
    expect(await settle(postSignup(STAGE3))).toHaveProperty("error");
    expect(calls).toHaveBeenCalledTimes(3);
  });
});

describe("postEvent", () => {
  it("never retries", async () => {
    // postEvent forces the fetch adapter (keepalive) → stub fetch instead of the axios adapter.
    const fetchMock = vi.fn(async () => new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await settle(
      postEvent({
        stage: "event",
        name: "demo_request",
        session_id: "s",
        variant: "a",
        src: null,
        lang: "en",
        meta: {},
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getStats", () => {
  const STATS = { total: 120, remaining: 40, cities: { bay_area: 10 } };

  it("returns a well-formed body", async () => {
    script({ status: 200, data: STATS });
    expect(await settle(getStats())).toEqual({ value: STATS });
  });

  it.each([
    ["an HTML fallback page", "<!doctype html>"],
    ["a body without cities", { total: 120, remaining: 40 }],
    ["a body with cities: null", { ...STATS, cities: null }],
    ["a body without remaining", { total: 120, cities: {} }],
  ])("rejects %s", async (_, data) => {
    script({ status: 200, data });
    expect(await settle(getStats())).toHaveProperty("error");
  });
});

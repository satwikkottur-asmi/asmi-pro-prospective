import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { CityKey } from "@/config";
import type { ApiError, SignupRequest, SignupResponses, Stage1Request, Stats } from "./api-types";

// In-browser fake backend for MOCK_API_CALL=true (typed by ./api-types.ts).
// - Phone ending in 0000 → `400 phone` (exercises the error path)
// - Stage 2 confirms: bumps total + city counts; returns overall `position` and `city_position`
// - Analytics events are logged to the console instead of sent
const LATENCY_MS = 400;

// Sample numbers; the real backend decides how they're computed.
const STATS: Stats = {
  total: 360,
  remaining: 144,
  cities: { bay_area: 30, los_angeles: 14, new_york: 9, other: 3 },
};

const cityByToken = new Map<string, CityKey>(); // stage-1 token → picked city

type Reply = [200, SignupResponses[keyof SignupResponses]] | [400, ApiError];

const isBadPhone = (body: Stage1Request) => body.phone.replace(/\D/g, "").endsWith("0000");

function respond(body: SignupRequest): Reply {
  switch (body.stage) {
    case 1: {
      if (isBadPhone(body)) return [400, { ok: false, error: "phone" }];
      const token = crypto.randomUUID();
      cityByToken.set(token, body.city);
      return [200, { ok: true, token, ref_code: "MOCK1234", city: body.city }];
    }
    case 2: {
      const city = cityByToken.get(body.token);
      if (!city) return [400, { ok: false, error: "token" }];
      STATS.total += 1;
      STATS.remaining = Math.max(0, STATS.remaining - 1);
      STATS.cities[city] += 1;
      return [200, { ok: true, position: STATS.total, city_position: STATS.cities[city] }];
    }
    case 3:
      return [200, { ok: true }];
    case "event":
      console.debug("[mock api] event", body.name, body.meta);
      return [200, { ok: true }];
    default:
      return [400, { ok: false, error: "stage" }];
  }
}

export async function mockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  let status = 200;
  // Copy, not the live object: stage 2 mutates STATS, and React Query must see a new reference.
  let data: unknown = structuredClone(STATS);
  if (config.method === "post") {
    const body: SignupRequest = JSON.parse(String(config.data));
    [status, data] = respond(body);
    if (body.stage !== "event") console.debug("[mock api]", config.url, body, "→", status, data);
  }
  // Every request, GETs too → the "hidden until stats load" state shows in mock mode.
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
  // Like the real adapters: non-2xx rejects so the retry interceptor and postSignup see an error.
  if (status >= 400)
    throw new AxiosError(`Mock ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response);
  return response;
}

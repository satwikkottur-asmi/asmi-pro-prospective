import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { ApiError, SignupRequest, SignupResponses, Stage1Request, Stats } from "./api-types";

// In-browser fake backend for MOCK_API_CALL=true (typed by ./api-types.ts).
// - Phone ending in 0000 → `400 phone` (exercises the error path)
// - Analytics events are logged to the console instead of sent
const LATENCY_MS = 400;

const STATS: Stats = {
  total: 486,
  remaining: 18,
  cities: { bay_area: 120, los_angeles: 40, new_york: 18, other: 4 },
  recent7d: 12,
  recent: [
    { trade: "hvac", place: "Oakland", when: "today" },
    { trade: "plumbing", place: "Brooklyn", when: "today" },
    { trade: "electrical", place: "Pasadena", when: "yesterday" },
    { trade: null, place: "San Jose", when: "this week" },
  ],
};

let position = 304;

type Reply = [200, SignupResponses[keyof SignupResponses]] | [400, ApiError];

const isBadPhone = (body: Stage1Request) => body.phone.replace(/\D/g, "").endsWith("0000");

function respond(body: SignupRequest): Reply {
  switch (body.stage) {
    case 1:
      if (isBadPhone(body)) return [400, { ok: false, error: "phone" }];
      return [200, { ok: true, token: crypto.randomUUID(), ref_code: "MOCK1234", city: body.city }];
    case 2:
      position += 1;
      return [200, { ok: true, position }];
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
  let data: unknown = STATS;
  if (config.method === "post") {
    const body: SignupRequest = JSON.parse(String(config.data));
    [status, data] = respond(body);
    if (body.stage !== "event") console.debug("[mock api]", config.url, body, "→", status, data);
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  }
  const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
  // Like the real adapters: non-2xx rejects so the retry interceptor and postSignup see an error.
  if (status >= 400)
    throw new AxiosError(`Mock ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response);
  return response;
}

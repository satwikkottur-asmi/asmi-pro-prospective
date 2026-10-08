import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Sent = { name: string; meta: { path: string } };
const postEvent = vi.fn(async (_body: Sent) => ({
  ok: true as const,
  data: { ok: true as const },
}));
vi.mock("@/lib/api", () => ({ postEvent }));

// Fresh modules per test: entryPath and the one-page_view flag are module state.
async function land(url: string) {
  window.history.replaceState(null, "", url);
  vi.resetModules();
  const { applyShortLink } = await import("@/lib/short-link");
  const { AppProvider, getAttribution } = await import("@/lib/app-context");
  applyShortLink();
  render(<AppProvider search={{}}>{null}</AppProvider>);
  const pageView = postEvent.mock.calls.map(([body]) => body).find((b) => b.name === "page_view");
  const { pathname, search, hash } = window.location;
  return {
    url: pathname + search + hash,
    path: pageView?.meta.path,
    landing: getAttribution().landing_path,
  };
}

beforeEach(() => {
  postEvent.mockClear();
  sessionStorage.clear();
});

describe("short links", () => {
  it("shows the home page but records the short link in page_view + attribution", async () => {
    expect(await land("/pros?utm_source=door#faq")).toEqual({
      url: "/?utm_source=door#faq",
      path: "/pros",
      landing: "/pros",
    });
  });

  it("matches case-insensitively, with a trailing slash, and records the tag lowercased", async () => {
    expect(await land("/PROS/")).toEqual({ url: "/", path: "/pros", landing: "/pros" });
  });

  it("leaves other paths alone", async () => {
    expect(await land("/join")).toEqual({ url: "/join", path: "/join", landing: "/join" });
  });
});

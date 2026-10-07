import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "@/routes";

// Match routes without rendering: pages need the app context and network.
const leafPath = (url: string) => matchRoutes(routes, url)?.at(-1)?.route.path;

describe("App routing", () => {
  it("matches the landing page for /", () => {
    expect(leafPath("/")).toBe("/");
  });

  it("matches the signup page for /join", () => {
    expect(leafPath("/join")).toBe("/join");
  });

  it("falls back to not found for unknown paths", () => {
    expect(leafPath("/nope")).toBe("*");
  });
});

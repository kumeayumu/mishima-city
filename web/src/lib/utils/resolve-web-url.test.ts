import { describe, expect, it } from "vitest";
import { resolveWebUrl } from "./resolve-web-url";

describe("resolveWebUrl", () => {
  it("keeps the local default", () => {
    expect(resolveWebUrl({})).toBe("http://localhost:3002");
  });
  it("uses the deployment hostname for the first Vercel deployment", () => {
    expect(
      resolveWebUrl({ vercel: "1", deploymentHostname: "preview.vercel.app" })
    ).toBe("https://preview.vercel.app");
  });
  it("prefers the explicit public origin", () => {
    expect(
      resolveWebUrl({
        explicitUrl: "https://example.com/",
        vercel: "1",
        deploymentHostname: "preview.vercel.app",
      })
    ).toBe("https://example.com");
  });
  it("fails instead of publishing localhost when system variables are missing", () => {
    expect(() => resolveWebUrl({ vercel: "1" })).toThrow("NEXT_PUBLIC_WEB_URL");
  });
  it.each([
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?secret=1",
    "javascript:alert(1)",
  ])("rejects invalid Vercel origin %s", (explicitUrl) => {
    expect(() => resolveWebUrl({ explicitUrl, vercel: "1" })).toThrow();
  });
});

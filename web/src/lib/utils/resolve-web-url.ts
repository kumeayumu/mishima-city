/** Explicit URL wins; Vercel supplies its deployment hostname at build time. */
export function resolveWebUrl(settings: {
  explicitUrl?: string;
  vercel?: string;
  deploymentHostname?: string;
}): string {
  const value =
    settings.explicitUrl ||
    (settings.vercel === "1" && settings.deploymentHostname
      ? `https://${settings.deploymentHostname}`
      : undefined);
  if (!value) {
    if (settings.vercel === "1") {
      throw new Error(
        "Set NEXT_PUBLIC_WEB_URL or enable the VERCEL_URL system variable"
      );
    }
    return "http://localhost:3002";
  }
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (settings.vercel === "1" && url.protocol !== "https:")
  ) {
    throw new Error("Web URL must be an origin; Vercel requires HTTPS");
  }
  return url.origin;
}

import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("allows archive configuration without database credentials and rejects actual DB use", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.resetModules();
  const { env } = await import("./env");
  expect(env.webUrl).toBeTruthy();
  expect(() => env.supabaseUrl).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  expect(() => env.supabaseAnonKey).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
});

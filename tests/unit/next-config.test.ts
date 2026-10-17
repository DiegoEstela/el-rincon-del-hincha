import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "@/lib/security-headers";

afterEach(() => vi.unstubAllEnvs());

describe("next.config", () => {
  it("injects only the app version into the client bundle", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version: string;
    };
    expect(nextConfig.env).toEqual({ NEXT_PUBLIC_APP_VERSION: pkg.version });
  });

  it("hides the X-Powered-By header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sets the security headers on every path", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([
      { source: "/:path*", headers: securityHeaders({ dev: false, vercelPreview: false }) },
    ]);
  });

  it("allows the Vercel Toolbar only on previews", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const preview = (await nextConfig.headers!())[0].headers[0].value;
    expect(preview).toContain("https://vercel.live");
    vi.stubEnv("VERCEL_ENV", "production");
    const production = (await nextConfig.headers!())[0].headers[0].value;
    expect(production).not.toContain("vercel.live");
  });
});

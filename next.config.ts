import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  async headers() {
    // Plain header rules (no proxy, no request API), so every route stays a static shell.
    const headers = securityHeaders({
      dev: process.env.NODE_ENV === "development",
      vercelPreview: process.env.VERCEL_ENV === "preview",
    });
    return [{ source: "/:path*", headers }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

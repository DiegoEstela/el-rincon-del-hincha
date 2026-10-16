import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config", () => {
  it("injects only the app version into the client bundle", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version: string;
    };
    expect(nextConfig.env).toEqual({ NEXT_PUBLIC_APP_VERSION: pkg.version });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => JSON.parse(readFileSync(join(process.cwd(), file), "utf8"));

describe("release-please configuration", () => {
  const config = read("release-please-config.json");
  const manifest = read(".release-please-manifest.json");

  it("uses the node release type with plain vX.Y.Z tags", () => {
    expect(config["release-type"]).toBe("node");
    expect(config["include-component-in-tag"]).toBe(false);
  });

  it("keeps breaking changes at minor while below 1.0.0", () => {
    expect(config["bump-minor-pre-major"]).toBe(true);
    expect(config["bump-patch-for-minor-pre-major"]).not.toBe(true);
  });

  it("anchors the last released version below 1.0.0 and in sync with package.json", () => {
    const pkg = read("package.json") as { version: string };
    expect(manifest["."]).toBe("0.1.0");
    expect(manifest["."].startsWith("0.")).toBe(true);
    expect(pkg.version).toBe(manifest["."]);
  });

  it("does not force a 1.0.0 release", () => {
    expect(JSON.stringify(config)).not.toMatch(/"release-as"\s*:\s*"1\./);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => JSON.parse(readFileSync(join(process.cwd(), file), "utf8"));

// The release rule: while pre-1.0 the manifest stays below 1.0.0 and equals package.json.
const isValidPreMajorRelease = (manifestVersion: string, pkgVersion: string): boolean =>
  manifestVersion.startsWith("0.") && manifestVersion === pkgVersion;

describe("isValidPreMajorRelease", () => {
  it.each([
    ["0.1.0", "0.1.0", true],
    ["0.2.0", "0.2.0", true],
    ["1.0.0", "1.0.0", false],
    ["0.2.0", "0.1.0", false],
  ])("manifest %s with package.json %s is %s", (manifestVersion, pkgVersion, expected) => {
    expect(isValidPreMajorRelease(manifestVersion, pkgVersion)).toBe(expected);
  });
});

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
    expect(manifest["."].startsWith("0.")).toBe(true);
    expect(pkg.version).toBe(manifest["."]);
    expect(isValidPreMajorRelease(manifest["."], pkg.version)).toBe(true);
  });

  it("lets the action read the config files: the workflow must not pass release-type", () => {
    // With the release-type input, release-please-action v4 ignores the config and manifest.
    const workflow = readFileSync(
      join(process.cwd(), ".github", "workflows", "release-please.yml"),
      "utf8",
    );
    const code = workflow
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(code).toContain("googleapis/release-please-action@v4");
    expect(code).not.toMatch(/release-type/);
  });

  it("does not force a 1.0.0 release", () => {
    expect(JSON.stringify(config)).not.toMatch(/"release-as"\s*:\s*"1\./);
  });
});

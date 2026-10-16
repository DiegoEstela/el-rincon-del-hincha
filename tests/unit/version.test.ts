import { describe, expect, it } from "vitest";
import { CREDITS, formatVersion } from "@/lib/version";

describe("version", () => {
  it("formats only the version, with no commit", () => {
    expect(formatVersion("0.4.2")).toBe("v0.4.2");
    expect(formatVersion()).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(formatVersion()).not.toContain("·");
  });

  it("exposes the mandatory credits", () => {
    expect(CREDITS.author).toBe("Diego Estela Lopez");
    expect(CREDITS.originalIdea).toBe("Juan Farre");
  });
});

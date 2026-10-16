import { describe, expect, it } from "vitest";
import { CREDITS, formatVersion } from "@/lib/version";

describe("version", () => {
  it("formats version and commit", () => {
    expect(formatVersion("0.4.2", "a1b2c3d")).toBe("v0.4.2 · a1b2c3d");
  });

  it("exposes the mandatory credits", () => {
    expect(CREDITS.author).toBe("Diego Estela Lopez");
    expect(CREDITS.originalIdea).toBe("Juan Farre");
  });
});

import { describe, expect, it } from "vitest";
import { parseRootTokens } from "@/lib/css-tokens";

const css = `
@import "tailwindcss";
/* --commented: #000; */
:root {
  --background: #07140d;
  --glass: rgb(255 255 255 / 0.06);
  color-scheme: dark;
}
@theme inline {
  --color-background: var(--background);
}
`;

describe("parseRootTokens", () => {
  const tokens = parseRootTokens(css);

  it("extracts custom properties from the first :root block", () => {
    expect(tokens.background).toBe("#07140d");
    expect(tokens.glass).toBe("rgb(255 255 255 / 0.06)");
  });

  it("ignores comments, non custom properties and @theme", () => {
    expect(tokens.commented).toBeUndefined();
    expect(tokens["color-scheme"]).toBeUndefined();
    expect(tokens["color-background"]).toBeUndefined();
  });

  it("throws when there is no :root block", () => {
    expect(() => parseRootTokens("body { color: red; }")).toThrow(/:root/);
  });
});

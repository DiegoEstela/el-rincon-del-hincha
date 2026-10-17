import { describe, expect, it } from "vitest";
import { cspDirectives, securityHeaders, serializeCsp } from "@/lib/security-headers";

const prod = { dev: false, vercelPreview: false };
const preview = { dev: false, vercelPreview: true };

describe("cspDirectives (production)", () => {
  it("is exactly the approved policy", () => {
    expect(cspDirectives(prod)).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'none'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
    });
  });
  it("never allows eval in production", () => {
    expect(cspDirectives(prod)["script-src"]).not.toContain("'unsafe-eval'");
  });
  it("allows eval only in dev, and changes nothing else", () => {
    const dev = cspDirectives({ dev: true, vercelPreview: false });
    expect(dev["script-src"]).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    expect({ ...dev, "script-src": [] }).toEqual({ ...cspDirectives(prod), "script-src": [] });
  });
  // Next's own inline scripts cannot be hashed. A hash or nonce next to 'unsafe-inline' makes the
  // browser ignore 'unsafe-inline' and hydration dies silently (ADR 0014).
  it("has no hash or nonce source in script-src while it keeps 'unsafe-inline'", () => {
    for (const options of [prod, preview, { dev: true, vercelPreview: false }]) {
      const scripts = cspDirectives(options)["script-src"];
      expect(scripts).toContain("'unsafe-inline'");
      expect(scripts.some((source) => /^'(sha256|sha384|sha512|nonce)-/.test(source))).toBe(false);
    }
  });
  it("forbids framing and plugins", () => {
    expect(cspDirectives(prod)["frame-ancestors"]).toEqual(["'none'"]);
    expect(cspDirectives(prod)["object-src"]).toEqual(["'none'"]);
  });
  it("has no wildcard, https: or upgrade-insecure-requests", () => {
    const directives = cspDirectives(prod);
    for (const name of ["connect-src", "img-src", "font-src"]) {
      expect(directives[name]).not.toContain("*");
      expect(directives[name]).not.toContain("https:");
    }
    expect("upgrade-insecure-requests" in directives).toBe(false);
  });
});

describe("cspDirectives (Vercel preview)", () => {
  it("adds the Vercel Toolbar origins from Vercel's documentation", () => {
    const directives = cspDirectives(preview);
    expect(directives["script-src"]).toContain("https://vercel.live");
    expect(directives["style-src"]).toContain("https://vercel.live");
    expect(directives["connect-src"]).toEqual([
      "'self'",
      "https://vercel.live",
      "wss://ws-us3.pusher.com",
    ]);
    expect(directives["img-src"]).toEqual([
      "'self'",
      "data:",
      "https://vercel.live",
      "https://vercel.com",
      "blob:",
    ]);
    expect(directives["font-src"]).toEqual([
      "'self'",
      "https://vercel.live",
      "https://assets.vercel.com",
    ]);
    expect(directives["frame-src"]).toEqual(["'self'", "https://vercel.live"]);
  });
  it("only adds to the production values, directive by directive", () => {
    const base = cspDirectives(prod);
    const extended = cspDirectives(preview);
    for (const [name, sources] of Object.entries(base)) {
      for (const source of sources) expect(extended[name], name).toContain(source);
    }
  });
  it("keeps framing, plugins and base uri closed", () => {
    for (const name of ["frame-ancestors", "object-src", "base-uri"]) {
      expect(cspDirectives(preview)[name]).toEqual(cspDirectives(prod)[name]);
    }
  });
});

describe("serializeCsp", () => {
  it("joins directives in order with no trailing semicolon or newline", () => {
    expect(serializeCsp({ "default-src": ["'self'"], "img-src": ["'self'", "data:"] })).toBe(
      "default-src 'self'; img-src 'self' data:",
    );
  });
  it("throws on a value that could split the header or the policy", () => {
    for (const bad of ["a;b", "a,b", "a\nb"]) {
      expect(() => serializeCsp({ "default-src": [bad] })).toThrow(RangeError);
    }
  });
});

describe("securityHeaders", () => {
  it("returns exactly the five production headers", () => {
    const headers = securityHeaders(prod);
    expect(headers.map((header) => header.key)).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
    ]);
    const value = (key: string) => headers.find((header) => header.key === key)?.value;
    expect(value("Content-Security-Policy")).toBe(serializeCsp(cspDirectives(prod)));
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Referrer-Policy")).toBe("same-origin");
    expect(value("X-Frame-Options")).toBe("DENY");
    expect(value("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    );
  });
  it("has no newline in any value", () => {
    for (const options of [prod, preview, { dev: true, vercelPreview: false }]) {
      for (const header of securityHeaders(options)) expect(header.value).not.toMatch(/[\r\n]/);
    }
  });
});

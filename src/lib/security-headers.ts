// Security headers of the app (ADR 0014, plan 0010). Pure: `next.config.ts` only wires the result.
//
// WHY `script-src` HAS `'unsafe-inline'` AND NO HASH OR NONCE: Next ships dozens of inline scripts
// per page (the Turbopack bootstrap and the RSC flight chunks) whose content changes per page and
// per build, and it cannot hash them. A nonce would make every route dynamic. And if any hash or
// nonce is listed next to `'unsafe-inline'`, browsers ignore `'unsafe-inline'`, which blocks those
// scripts and kills hydration. The unit test pins this invariant.

export type PolicyOptions = { dev: boolean; vercelPreview: boolean };
export type CspDirectives = Record<string, string[]>;
export type SecurityHeader = { key: string; value: string };

const SELF = "'self'";
const VERCEL_LIVE = "https://vercel.live";

/** The policy as data, in the order it is serialized. */
export function cspDirectives({ dev, vercelPreview }: PolicyOptions): CspDirectives {
  const directives: CspDirectives = {
    "default-src": [SELF],
    "script-src": [SELF, "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": [SELF, "'unsafe-inline'"],
    "img-src": [SELF, "data:"],
    "font-src": [SELF],
    "connect-src": [SELF],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": [SELF],
    "frame-ancestors": ["'none'"],
  };
  if (vercelPreview) {
    // Vercel Toolbar and Comments on previews only: https://vercel.com/docs/vercel-toolbar/managing-toolbar
    directives["script-src"].push(VERCEL_LIVE);
    directives["style-src"].push(VERCEL_LIVE);
    directives["connect-src"].push(VERCEL_LIVE, "wss://ws-us3.pusher.com");
    directives["img-src"].push(VERCEL_LIVE, "https://vercel.com", "blob:");
    directives["font-src"].push(VERCEL_LIVE, "https://assets.vercel.com");
    directives["frame-src"] = [SELF, VERCEL_LIVE];
  }
  return directives;
}

/** `name v1 v2; name v1`. Throws on a value that could split the header or the policy. */
export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, sources]) => {
      for (const source of sources) {
        if (/[;,\r\n]/.test(source)) throw new RangeError(`CSP source of ${name} is not valid.`);
      }
      return [name, ...sources].join(" ");
    })
    .join("; ");
}

export function securityHeaders(options: PolicyOptions): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: serializeCsp(cspDirectives(options)) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
}

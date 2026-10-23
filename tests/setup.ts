import "@testing-library/jest-dom/vitest";

// Tests never reach rsssf.org (plan 0017, T11): only `pnpm data:snapshot` requests it, by hand.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (/(^|\.)rsssf\.org/i.test(new URL(url, "http://localhost").hostname)) {
    throw new Error("a test tried to reach rsssf.org");
  }
  return realFetch(input, init);
}) as typeof fetch;

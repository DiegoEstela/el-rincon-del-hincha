import { describe, expect, it } from "vitest";

describe("tests never reach rsssf.org (plan 0017, T11)", () => {
  it("blocks any request to the host, from the test setup", () => {
    expect(() => fetch("https://www.rsssf.org/tablesa/arg2019.html")).toThrow(/rsssf\.org/);
    expect(() => fetch(new Request("https://rsssf.org/x"))).toThrow(/rsssf\.org/);
    expect(() => fetch(new URL("https://www.rsssf.org/x"))).toThrow(/rsssf\.org/);
  });
});

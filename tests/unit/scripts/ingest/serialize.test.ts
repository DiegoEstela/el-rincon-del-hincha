import * as prettier from "prettier";
import { describe, expect, it } from "vitest";
import { serializeRecords } from "../../../../scripts/ingest/core/serialize";

const season = (id: string) => ({
  id,
  competition_id: "liga",
  name: `Season ${id}`,
  start: "2024-01-01",
  end: "2024-12-31",
  source: "https://example.org/s",
});

describe("serializeRecords", () => {
  it("sorts records by key and ends with a single newline", async () => {
    const out = await serializeRecords("seasons.json", [season("b"), season("a")]);
    const ids = (JSON.parse(out) as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(["a", "b"]);
    expect(out.endsWith("}\n]\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("gives identical bytes for shuffled input and shuffled object keys", async () => {
    const shuffled = {
      source: "https://example.org/s",
      end: "2024-12-31",
      start: "2024-01-01",
      name: "Season a",
      competition_id: "liga",
      id: "a",
    };
    const one = await serializeRecords("seasons.json", [season("a"), season("b")]);
    const two = await serializeRecords("seasons.json", [season("b"), shuffled as never]);
    expect(two).toBe(one);
  });

  it("follows the schema key order", async () => {
    const out = await serializeRecords("seasons.json", [season("a")]);
    const keys = Object.keys((JSON.parse(out) as object[])[0]);
    expect(keys).toEqual(["id", "competition_id", "name", "start", "end", "source"]);
  });

  it("is stable under Prettier", async () => {
    const out = await serializeRecords("competitions.json", [
      {
        id: "liga",
        name: "Liga",
        type: "league",
        scope: "domestic",
        organizer: "AFA",
        afa_recognized: true,
        source: "https://example.org/c",
      },
    ]);
    const formatted = await prettier.format(out, { parser: "json", printWidth: 100 });
    expect(formatted).toBe(out);
  });

  it("writes an empty list as []", async () => {
    expect(await serializeRecords("matches.json", [])).toBe("[]\n");
  });

  it("rejects duplicate keys", async () => {
    await expect(serializeRecords("seasons.json", [season("a"), season("a")])).rejects.toThrow(
      /duplicate.*a/i,
    );
  });

  it("rejects a record without a usable key", async () => {
    await expect(serializeRecords("seasons.json", [{ name: "x" } as never])).rejects.toThrow(
      /key/i,
    );
  });
});

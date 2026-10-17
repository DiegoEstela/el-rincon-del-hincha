import { describe, expect, it } from "vitest";
import { mergeDataset } from "../../../../scripts/ingest/core/merge";

const OF = "https://github.com/openfootball/south-america/blob/abc/argentina/";
const match = (id: string, source: string) => ({ id, source });
const comp = (extra = {}) => ({ id: "liga", name: "Liga", afa_recognized: true, ...extra });
const season = (id: string) => ({ id, competition_id: "liga" });

describe("mergeDataset", () => {
  it("replaces every owned match and keeps the foreign ones", () => {
    const result = mergeDataset(
      { "matches.json": [match("old", `${OF}2020.txt#L1`), match("kaggle", "https://kaggle/x")] },
      { competitions: [], seasons: [], matches: [match("new", `${OF}2024.txt#L9`)] },
      OF,
    );
    expect(result.conflicts).toEqual([]);
    expect(result.dataset["matches.json"]).toEqual([
      match("kaggle", "https://kaggle/x"),
      match("new", `${OF}2024.txt#L9`),
    ]);
  });

  it("adds missing reference records and keeps deep-equal ones", () => {
    const result = mergeDataset(
      { "competitions.json": [comp()], "seasons.json": [season("a")] },
      { competitions: [comp()], seasons: [season("a"), season("b")], matches: [] },
      OF,
    );
    expect(result.conflicts).toEqual([]);
    expect(result.dataset["competitions.json"]).toHaveLength(1);
    expect(result.dataset["seasons.json"]).toHaveLength(2);
  });

  it("is not affected by key order when comparing records", () => {
    const reordered = { afa_recognized: true, name: "Liga", id: "liga" };
    const result = mergeDataset(
      { "competitions.json": [reordered] },
      { competitions: [comp()], seasons: [], matches: [] },
      OF,
    );
    expect(result.conflicts).toEqual([]);
  });

  it("reports a conflict naming the file, id and fields when a record differs", () => {
    const result = mergeDataset(
      { "competitions.json": [comp({ afa_recognized: false })] },
      { competitions: [comp()], seasons: [], matches: [] },
      OF,
    );
    expect(result.conflicts).toEqual([
      "competitions.json#liga differs from the adapter config in: afa_recognized",
    ]);
  });

  it("starts from empty files when the dataset has none", () => {
    const result = mergeDataset({}, { competitions: [comp()], seasons: [], matches: [] }, OF);
    expect(result.dataset["competitions.json"]).toEqual([comp()]);
    expect(result.dataset["matches.json"]).toEqual([]);
  });
});

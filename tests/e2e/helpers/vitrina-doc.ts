// A club document for the end to end tests of the vitrina, built from the synthetic stats world
// (FICTIONAL data) with its ids replaced by real club ids, so the app accepts the saved club while
// the titles do not depend on what is loaded in data/.
import { sliceClubData } from "../../../src/domain/club-data";
import { statsDataFrom } from "../../../src/domain/data";
import { statsWorld } from "../../fixtures/domain/stats-world";

const IDS: [string, string][] = [
  ["club-a", "river-plate"],
  ["club-b", "boca-juniors"],
];

export function riverDocument(): unknown {
  let text = JSON.stringify(sliceClubData(statsDataFrom(statsWorld()), "club-a"));
  for (const [from, to] of IDS) text = text.replaceAll(from, to);
  return JSON.parse(text);
}

/** The same document with no title at all. */
export function riverDocumentWithoutTitles(): unknown {
  return { ...(riverDocument() as object), titles: [] };
}

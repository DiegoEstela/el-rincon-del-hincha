// The RSSSF adapter object: wires the manifest, the excerpts, the layout parsers and the normalizer
// (plan 0017, ADR 0020). It reads the pinned excerpts of `sources/rsssf`; only `pnpm data:snapshot`
// ever requests rsssf.org.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Adapter } from "../core/adapter";
import { IngestError } from "../core/errors";
import { RSSSF_SOURCE_PREFIX, RSSSF_TOURNAMENTS, type TournamentConfig } from "./config";
import { parseFullNames2017 } from "./layouts/full-names-2017";
import { excerptFileName, manifestSchema, type Manifest, type ManifestPage } from "./manifest";
import { normalizeRsssf, type RawTournament } from "./normalize";
import { prepareText } from "./text";
import type { LayoutContext, ParsedTournament } from "./types";
import type { PreparedText } from "./text";

export const RSSSF_INPUT_DIR = "sources/rsssf";

type LayoutParser = (text: PreparedText, ctx: LayoutContext) => ParsedTournament;

/** One strict parser per layout; a layout without one stops the run instead of guessing. */
const PARSERS: Partial<Record<ManifestPage["layout"], LayoutParser>> = {
  "full-names-2017": parseFullNames2017,
};

export type RsssfConfig = {
  tournaments: readonly TournamentConfig[];
  /** The reviewed manifest, read when the adapter loads (default: `sources/rsssf/manifest.json`). */
  manifest: () => Manifest;
};

const readManifest = (): Manifest =>
  manifestSchema.parse(
    JSON.parse(readFileSync(join(resolve(RSSSF_INPUT_DIR), "manifest.json"), "utf8")),
  );

const DEFAULT_CONFIG: RsssfConfig = { tournaments: RSSSF_TOURNAMENTS, manifest: readManifest };

/** `config` is injectable so tests can use fixtures and small tournament lists. */
export function createRsssfAdapter(config: RsssfConfig = DEFAULT_CONFIG): Adapter<RawTournament[]> {
  return {
    id: "rsssf",
    sourcePrefix: RSSSF_SOURCE_PREFIX,
    defaultInputDir: RSSSF_INPUT_DIR,
    extends: config.tournaments.filter((t) => t.mode.kind === "extends").map((t) => t.id),
    async load(loader) {
      const manifest = config.manifest();
      const raws: RawTournament[] = [];
      for (const tournament of config.tournaments) {
        const page = manifest.pages.find((p) => p.url.endsWith(`/${tournament.page}.html`));
        const excerpt = page?.excerpts.find((e) => e.name === tournament.excerpt);
        if (page === undefined || excerpt === undefined) {
          throw new IngestError([
            `${tournament.page}.${tournament.excerpt}: not in the manifest of sources/rsssf`,
          ]);
        }
        const parser = PARSERS[page.layout];
        if (parser === undefined) {
          throw new IngestError([`${page.url}: the layout "${page.layout}" has no parser yet`]);
        }
        const file = excerptFileName(page.url, excerpt.name);
        const text = await loader({
          name: file,
          url: page.url,
          sha256: excerpt.sha256,
          encoding: page.encoding,
        });
        const parsed = parser(prepareText(text, `${tournament.page}.${tournament.excerpt}`), {
          window: tournament.window,
          ignore: page.ignore,
        });
        raws.push({ tournament, page, parsed });
      }
      return raws;
    },
    normalize(raws, { clubs }) {
      return normalizeRsssf(raws, clubs);
    },
  };
}

export const rsssfAdapter = createRsssfAdapter();

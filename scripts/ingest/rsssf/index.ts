// The RSSSF adapter object: wires the manifest, the excerpts, the layout parsers and the normalizer
// (plan 0017, ADR 0020). It reads the pinned excerpts of `sources/rsssf`; only `pnpm data:snapshot`
// ever requests rsssf.org.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Adapter, SourceLoader } from "../core/adapter";
import { IngestError } from "../core/errors";
import type { Competition } from "../../../src/data-model/types";
import {
  RSSSF_CHAMPIONS,
  RSSSF_SOURCE_PREFIX,
  RSSSF_TITLE_SEASONS,
  RSSSF_CUP_TOURNAMENTS,
  RSSSF_TOURNAMENTS,
  type TournamentConfig,
} from "./config";
import { parseChampionsList, type ParsedChampions } from "./layouts/champions-list";
import { parseCupFullNames } from "./layouts/cup-full-names";
import { parseFullNames2017 } from "./layouts/full-names-2017";
import { excerptFileName, manifestSchema, type Manifest, type ManifestPage } from "./manifest";
import { normalizeRsssf, type RawTournament } from "./normalize";
import { prepareText } from "./text";
import type { PreparedText } from "./text";
import type { LayoutContext, ParsedTournament, TitleSeason } from "./types";

export const RSSSF_INPUT_DIR = "sources/rsssf";

type LayoutParser = (text: PreparedText, ctx: LayoutContext) => ParsedTournament;

/** One strict parser per layout; a layout without one stops the run instead of guessing. */
const PARSERS: Partial<Record<ManifestPage["layout"], LayoutParser>> = {
  "full-names-2017": parseFullNames2017,
  "cup-full-names": parseCupFullNames,
};

/** What `load` reads: the tournaments, and the list of champions when the manifest has it. */
export type RsssfRaw = { tournaments: RawTournament[]; champions: ParsedChampions | null };

export type RsssfConfig = {
  tournaments: readonly TournamentConfig[];
  /** The competitions the adapter writes when it does not find them (default: the first division). */
  competitions?: readonly Competition[];
  /** The seasons whose champion is written as a title (needs the list of champions). */
  titleSeasons: readonly TitleSeason[];
  /** The reviewed manifest, read when the adapter loads (default: `sources/rsssf/manifest.json`). */
  manifest: () => Manifest;
};

const readManifest = (): Manifest =>
  manifestSchema.parse(
    JSON.parse(readFileSync(join(resolve(RSSSF_INPUT_DIR), "manifest.json"), "utf8")),
  );

const DEFAULT_CONFIG: RsssfConfig = {
  tournaments: [...RSSSF_TOURNAMENTS, ...RSSSF_CUP_TOURNAMENTS],
  titleSeasons: RSSSF_TITLE_SEASONS,
  manifest: readManifest,
};

function findExcerpt(manifest: Manifest, pageName: string, excerptName: string) {
  const page = manifest.pages.find((p) => p.url.endsWith(`/${pageName}.html`));
  const excerpt = page?.excerpts.find((e) => e.name === excerptName);
  return page === undefined || excerpt === undefined ? null : { page, excerpt };
}

async function readExcerpt(
  loader: SourceLoader,
  found: NonNullable<ReturnType<typeof findExcerpt>>,
  label: string,
): Promise<PreparedText> {
  const { page, excerpt } = found;
  const text = await loader({
    name: excerptFileName(page.url, excerpt.name),
    url: page.url,
    sha256: excerpt.sha256,
    encoding: page.encoding,
  });
  return prepareText(text, label);
}

/** `config` is injectable so tests can use fixtures and small tournament lists. */
export function createRsssfAdapter(
  config: Pick<RsssfConfig, "tournaments" | "manifest"> &
    Partial<Pick<RsssfConfig, "titleSeasons" | "competitions">> = DEFAULT_CONFIG,
): Adapter<RsssfRaw> {
  const titleSeasons = config.titleSeasons ?? [];
  return {
    id: "rsssf",
    sourcePrefix: RSSSF_SOURCE_PREFIX,
    defaultInputDir: RSSSF_INPUT_DIR,
    extends: config.tournaments.filter((t) => t.mode.kind === "extends").map((t) => t.id),
    async load(loader) {
      const manifest = config.manifest();
      const tournaments: RawTournament[] = [];
      for (const tournament of config.tournaments) {
        const label = `${tournament.page}.${tournament.excerpt}`;
        const found = findExcerpt(manifest, tournament.page, tournament.excerpt);
        if (found === null) {
          throw new IngestError([`${label}: not in the manifest of sources/rsssf`]);
        }
        const layout = found.excerpt.layout ?? found.page.layout;
        const parser = PARSERS[layout];
        if (parser === undefined) {
          throw new IngestError([`${found.page.url}: the layout "${layout}" has no parser yet`]);
        }
        const parsed = parser(await readExcerpt(loader, found, label), {
          window: tournament.window,
          ignore: found.page.ignore,
        });
        tournaments.push({ tournament, page: found.page, parsed });
      }

      const list = findExcerpt(manifest, RSSSF_CHAMPIONS.page, RSSSF_CHAMPIONS.excerpt);
      if (list === null) {
        if (titleSeasons.length > 0) {
          throw new IngestError([
            `${RSSSF_CHAMPIONS.page}.${RSSSF_CHAMPIONS.excerpt}: the list of champions is not in the manifest`,
          ]);
        }
        return { tournaments, champions: null };
      }
      const label = `${RSSSF_CHAMPIONS.page}.${RSSSF_CHAMPIONS.excerpt}`;
      return { tournaments, champions: parseChampionsList(await readExcerpt(loader, list, label)) };
    },
    normalize(raw, { clubs, existing }) {
      return normalizeRsssf(
        raw.tournaments,
        clubs,
        config.competitions,
        raw.champions === null ? undefined : { champions: raw.champions, titleSeasons, existing },
      );
    },
  };
}

export const rsssfAdapter = createRsssfAdapter();

// The openfootball adapter object: wires config, loader, parser and normalizer (plan 0011).
import type { Adapter } from "../core/adapter";
import type { Competition } from "../../../src/data-model/types";
import {
  OPENFOOTBALL_COMPETITIONS,
  OPENFOOTBALL_FILES,
  OPENFOOTBALL_SEASONS,
  OPENFOOTBALL_SOURCE_PREFIX,
  fileUrl,
  type OpenfootballFile,
  type OpenfootballSeason,
} from "./config";
import { normalizeOpenfootball } from "./normalize";
import { parseOpenfootball, type ParsedFile } from "./parse";

export type OpenfootballConfig = {
  files: readonly OpenfootballFile[];
  competitions: readonly Competition[];
  seasons: readonly OpenfootballSeason[];
};

const DEFAULT_CONFIG: OpenfootballConfig = {
  files: OPENFOOTBALL_FILES,
  competitions: OPENFOOTBALL_COMPETITIONS,
  seasons: OPENFOOTBALL_SEASONS,
};

/** `config` is injectable so tests can exercise failure modes without touching the real pins. */
export function createOpenfootballAdapter(
  config: OpenfootballConfig = DEFAULT_CONFIG,
): Adapter<ParsedFile[]> {
  return {
    id: "openfootball",
    sourcePrefix: OPENFOOTBALL_SOURCE_PREFIX,
    async load(loader) {
      const parsed: ParsedFile[] = [];
      for (const f of config.files) {
        const text = await loader({ name: f.file, url: fileUrl(f.file), sha256: f.sha256 });
        parsed.push(parseOpenfootball(f.file, text));
      }
      return parsed;
    },
    normalize(raw, { clubs }) {
      return normalizeOpenfootball(raw, clubs, config);
    },
  };
}

export const openfootballAdapter = createOpenfootballAdapter();

// Text pre-pass of the RSSSF parsers (plan 0017, ADR 0020 decision 3): strip the tags, decode the
// entities and keep a line number for every line, so an error can name the excerpt line. It is
// strict on purpose: an entity or a tag it does not understand stops the run.

export type TextLine = { /** 1-based line in the excerpt. */ line: number; text: string };
export type PreparedText = { file: string; lines: TextLine[] };

const MAX_LINE = 2000;
const MAX_LINES = 50_000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  ccedil: "ç",
  agrave: "à",
  egrave: "è",
  acirc: "â",
  ecirc: "ê",
  ocirc: "ô",
  atilde: "ã",
  otilde: "õ",
};

function decodeEntities(text: string, where: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body.startsWith("#x")
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (code > 0x10ffff) throw new Error(`${where}: the entity "${whole}" is out of range`);
      return String.fromCodePoint(code);
    }
    const value = ENTITIES[body];
    if (value === undefined) throw new Error(`${where}: unknown entity "${whole}"`);
    return value;
  });
}

// A tag starts with `<` and a letter, `/` or `!`; a lone `<` ("a < b") is text.
const TAG_START = /<[A-Za-z/!]/;

function stripTags(line: string, where: string): string {
  let out = "";
  let rest = line;
  for (;;) {
    const match = TAG_START.exec(rest);
    if (match === null) return out + rest;
    const close = rest.indexOf(">", match.index);
    if (close === -1) throw new Error(`${where}: a tag does not close on its line`);
    out += rest.slice(0, match.index);
    rest = rest.slice(close + 1);
  }
}

export function prepareText(raw: string, file: string): PreparedText {
  const rawLines = raw.split(/\r?\n/);
  if (rawLines.length > MAX_LINES) throw new Error(`${file}: too many lines (over ${MAX_LINES})`);
  const lines = rawLines.map((source, i) => {
    const where = `${file}:${i + 1}`;
    if (source.length > MAX_LINE) throw new Error(`${where}: the line is too long`);
    return { line: i + 1, text: decodeEntities(stripTags(source, where), where) };
  });
  return { file, lines };
}

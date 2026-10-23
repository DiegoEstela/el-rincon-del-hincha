// The credit RSSSF asked for (docs/spike/replies/2026-10-16-rsssf.md, plan 0017 D8): every author
// of every page we use, and a link to each page. Built from the reviewed manifest, so the credit
// can never name a page we do not use or miss one we do.

export type CreditSource = { pages: readonly { url: string; authors: readonly string[] }[] };

export type RsssfCredit = {
  authors: readonly string[];
  pages: readonly { url: string; label: string }[];
  /** "Muchas gracias a A y B y a la RSSSF (...) por proveer esta información." */
  sentence: string;
};

export const RSSSF_HOME = "https://www.rsssf.org/";

/** "A", "A y B", "A, B y C". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** "arg2025.html" -> "Argentina 2025", "copa2019.html" -> "Copa Libertadores 2019"; others keep their file name. */
function labelOf(url: string): string {
  const { pathname } = new URL(url);
  const name = pathname.slice(pathname.lastIndexOf("/") + 1).replace(/\.html$/, "");
  const league = /^arg(\d{2,4})$/.exec(name);
  if (league !== null) return `Argentina ${league[1]}`;
  const libertadores = /^copa(\d{4})$/.exec(name);
  if (libertadores !== null) return `Copa Libertadores ${libertadores[1]}`;
  const sudamericana = /^sudamcup(\d{4})$/.exec(name);
  return sudamericana === null ? name : `Copa Sudamericana ${sudamericana[1]}`;
}

export function rsssfCredit(source: CreditSource): RsssfCredit {
  const authors = [...new Set(source.pages.flatMap((page) => page.authors))];
  const who = authors.length === 0 ? "" : `${listOf(authors)} y a `;
  return {
    authors,
    pages: source.pages.map((page) => ({ url: page.url, label: labelOf(page.url) })),
    sentence: `Muchas gracias a ${who}la RSSSF (Rec.Sport.Soccer Statistics Foundation) por proveer esta información.`,
  };
}

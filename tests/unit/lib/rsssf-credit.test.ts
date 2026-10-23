import { describe, expect, it } from "vitest";
import { RSSSF_HOME, rsssfCredit } from "@/lib/rsssf-credit";

const page = (name: string, authors: string[]) => ({
  url: `https://www.rsssf.org/tablesa/${name}.html`,
  authors,
});

describe("rsssfCredit (plan 0017, D8)", () => {
  it("names the author and links the page", () => {
    const credit = rsssfCredit({ pages: [page("arg2025", ["Osvaldo José Gorgazzi"])] });
    expect(credit.authors).toEqual(["Osvaldo José Gorgazzi"]);
    expect(credit.pages).toEqual([
      { url: "https://www.rsssf.org/tablesa/arg2025.html", label: "Argentina 2025" },
    ]);
    expect(credit.sentence).toBe(
      "Muchas gracias a Osvaldo José Gorgazzi y a la RSSSF (Rec.Sport.Soccer Statistics Foundation) por proveer esta información.",
    );
  });

  it("names every author once, in order, joined the Spanish way", () => {
    const two = rsssfCredit({
      pages: [page("arg2025", ["A"]), page("arg2019", ["A", "B"]), page("arg71", ["B"])],
    });
    expect(two.authors).toEqual(["A", "B"]);
    expect(two.sentence).toContain("Muchas gracias a A y B y a la RSSSF");
    const three = rsssfCredit({ pages: [page("arg2025", ["A", "B", "C"])] });
    expect(three.sentence).toContain("A, B y C y a la RSSSF");
  });

  it("keeps the file name of a page that is not a year page", () => {
    expect(rsssfCredit({ pages: [page("arghist-pro1970s", ["A"])] }).pages[0].label).toBe(
      "arghist-pro1970s",
    );
  });

  it("still thanks RSSSF when there is no author", () => {
    expect(rsssfCredit({ pages: [] }).sentence).toBe(
      "Muchas gracias a la RSSSF (Rec.Sport.Soccer Statistics Foundation) por proveer esta información.",
    );
  });

  it("links the main page of RSSSF", () => {
    expect(RSSSF_HOME).toBe("https://www.rsssf.org/");
  });
});

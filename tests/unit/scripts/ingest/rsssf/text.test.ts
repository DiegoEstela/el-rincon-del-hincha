import { describe, expect, it } from "vitest";
import { prepareText } from "../../../../../scripts/ingest/rsssf/text";

describe("prepareText (plan 0017, T12)", () => {
  it("strips tags and keeps the visible text", () => {
    const out = prepareText('<pre>\n<a name="x">Round 1</a> <b>[Aug 10]</b>\n</pre>', "p.txt");
    expect(out.lines.map((l) => l.text)).toEqual(["", "Round 1 [Aug 10]", ""]);
  });

  it("decodes named and numeric entities", () => {
    const out = prepareText(
      "Col&oacute;n &amp; Uni&oacute;n&nbsp;&#233;&#xE9; &lt;x&gt; &quot;",
      "p",
    );
    expect(out.lines[0].text).toBe('Colón & Unión éé <x> "');
  });

  it("keeps spacing and tabs inside pre blocks", () => {
    const out = prepareText("<pre>\nA   1-0\tB\n</pre>", "p");
    expect(out.lines[1].text).toBe("A   1-0\tB");
  });

  it("maps every line to its line in the excerpt, 1-based", () => {
    const out = prepareText("one\r\ntwo\nthree", "arg.txt");
    expect(out.lines.map((l) => [l.line, l.text])).toEqual([
      [1, "one"],
      [2, "two"],
      [3, "three"],
    ]);
    expect(out.file).toBe("arg.txt");
  });

  it("fails on an unknown entity, naming the line", () => {
    expect(() => prepareText("ok\nbad &zzz; here", "p.txt")).toThrow(/p\.txt:2.*entity "&zzz;"/);
  });

  it("fails on a tag that does not close on its line", () => {
    expect(() => prepareText("a <b\nc>", "p.txt")).toThrow(/p\.txt:1.*tag/);
  });

  it("fails on a line over the cap and on input over the cap", () => {
    expect(() => prepareText("x".repeat(2001), "p")).toThrow(/line is too long/);
    expect(() => prepareText("x\n".repeat(60_000), "p")).toThrow(/too many lines/);
  });

  it("leaves a plain less-than sign that is not a tag", () => {
    expect(prepareText("a < b", "p").lines[0].text).toBe("a < b");
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Crest } from "@/components/crest";
import type { CrestSpec } from "@/lib/club-options";
import { SHIELD_PATH } from "@/lib/crest";

afterEach(cleanup);

const spec: CrestSpec = {
  pattern: "vertical_stripes",
  primary: "#d62828",
  secondary: "#ffffff",
  initials: "RC",
  initialsInk: "#ffffff",
};

describe("Crest", () => {
  it("draws the shield and the initials", () => {
    const { container } = render(<Crest spec={spec} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 100 120");
    expect(
      [...container.querySelectorAll("path")].some((p) => p.getAttribute("d") === SHIELD_PATH),
    ).toBe(true);
    expect(container.querySelector("text")?.textContent).toBe("RC");
  });
  it("is hidden from assistive tech by default", () => {
    const { container } = render(<Crest spec={spec} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("becomes an image with a name when given a title", () => {
    render(<Crest spec={spec} title="Escudo de Racing" />);
    const img = screen.getByRole("img", { name: "Escudo de Racing" });
    expect(img).not.toHaveAttribute("aria-hidden");
  });
  it("gives two crests of the same club different clip path ids", () => {
    const { container } = render(
      <>
        <Crest spec={spec} />
        <Crest spec={spec} />
      </>,
    );
    const ids = [...container.querySelectorAll("clipPath")].map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.every(Boolean)).toBe(true);
  });
  it("draws every pattern without images or external references", () => {
    for (const pattern of [
      "solid",
      "vertical_stripes",
      "sash",
      "hoops",
      "halves",
      "other",
    ] as const) {
      const { container, unmount } = render(
        <Crest spec={{ ...spec, pattern, tertiary: "#111111" }} />,
      );
      expect(container.querySelector("image")).toBeNull();
      expect(container.querySelector("[href]")).toBeNull();
      unmount();
    }
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClubPicker } from "@/components/onboarding/club-picker";
import { clubSchema } from "@/data-model/schemas";
import { toClubOptions } from "@/lib/club-options";
import clubsJson from "../../../data/clubs.json";

afterEach(cleanup);

const clubs = toClubOptions(clubSchema.array().parse(clubsJson));

function Harness({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ClubPicker
      clubs={clubs}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id);
        onSelect(id);
      }}
      searchRef={createRef<HTMLInputElement>()}
      groupRef={createRef<HTMLDivElement>()}
    />
  );
}

const radios = () => screen.queryAllByRole("radio");
const search = () => screen.getByRole("searchbox", { name: "Buscá tu club" });

describe("ClubPicker", () => {
  it("shows a radio per club and a search box", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Elegí tu club" })).toBeInTheDocument();
    expect(radios()).toHaveLength(34);
    expect(search()).toHaveAttribute("placeholder", "Ej.: Racing, Lanús, Newell's");
    expect(screen.getByRole("status")).toHaveTextContent("34 clubes");
  });
  it("names each tile with the short name and, when different, the full name", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /Boca\b.*Boca Juniors/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Aldosivi" })).toBeInTheDocument();
  });
  it("filters while typing and announces the count", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(search(), "velez");
    expect(radios()).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("1 club");
    expect(screen.getByRole("status")).not.toHaveTextContent("clubes");
  });
  it("shows the empty state and recovers with 'Ver todos los clubes'", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(search(), "zzz");
    expect(radios()).toHaveLength(0);
    expect(screen.getByText("No encontramos ese club")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Ningún club");
    await user.click(screen.getByRole("button", { name: "Ver todos los clubes" }));
    expect(radios()).toHaveLength(34);
    expect(search()).toHaveValue("");
    expect(search()).toHaveFocus();
  });
  it("selects on click and reports the id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await user.click(screen.getByRole("radio", { name: /Racing/ }));
    expect(onSelect).toHaveBeenCalledWith("racing-club");
    expect(screen.getByRole("radio", { name: /Racing/ })).toBeChecked();
    expect(screen.getByText("Elegiste a Racing")).toBeInTheDocument();
  });
  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Aldosivi" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Argentinos/ })).toBeChecked();
  });
  it("keeps the selected club when it is filtered out and back", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Racing/ }));
    await user.type(search(), "velez");
    expect(radios()).toHaveLength(1);
    expect(screen.getByText("Elegiste a Racing")).toBeInTheDocument();
    await user.clear(search());
    expect(screen.getByRole("radio", { name: /Racing/ })).toBeChecked();
  });
});

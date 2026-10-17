// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClubDocuments } from "@/components/fan/use-club-documents";
import { sliceClubData, type ClubData } from "@/domain/club-data";
import { statsDataFrom } from "@/domain/data";
import { RivalsScreen } from "@/components/rivals/rivals-screen";
import { toClubOption } from "@/lib/club-options";
import { clearFanChoice, getBrowserStorage, writeFanChoice } from "@/lib/fan-storage";
import { statsWorld } from "../../fixtures/domain/stats-world";

const world = statsWorld();
const data = statsDataFrom(world);
const docFor = (clubId: string): ClubData => sliceClubData(data, clubId);

afterEach(cleanup);

describe("useClubDocuments", () => {
  it("is idle without ids and never loads", () => {
    const loadData = vi.fn();
    const { result } = renderHook(() => useClubDocuments(null, loadData));
    expect(result.current.status).toBe("idle");
    expect(loadData).not.toHaveBeenCalled();
  });

  it("loads one id, then two, asking only for each id", async () => {
    const loadData = vi.fn(async (id: string) => docFor(id));
    const one = renderHook(() => useClubDocuments(["club-a"], loadData));
    expect(one.result.current.status).toBe("loading");
    await waitFor(() => expect(one.result.current.status).toBe("ready"));
    const two = renderHook(() => useClubDocuments(["club-a", "club-b"], loadData));
    await waitFor(() => expect(two.result.current.status).toBe("ready"));
    const ready = two.result.current;
    expect(ready.status === "ready" && ready.docs.map((d) => d.clubId)).toEqual([
      "club-a",
      "club-b",
    ]);
    expect(loadData.mock.calls.every((call) => call.length === 1)).toBe(true);
  });

  it("gives error when either document fails, and retry asks again", async () => {
    let failing = true;
    const loadData = vi.fn(async (id: string) => {
      if (id === "club-b" && failing) throw new Error("network");
      return docFor(id);
    });
    const { result } = renderHook(() => useClubDocuments(["club-a", "club-b"], loadData));
    await waitFor(() => expect(result.current.status).toBe("error"));
    failing = false;
    act(() => result.current.retry());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("drops the result when the ids change, so an old error does not come back", async () => {
    const loadData = vi.fn((id: string) =>
      id === "club-a" ? Promise.reject(new Error("x")) : new Promise<ClubData>(() => undefined),
    );
    const { result, rerender } = renderHook(({ ids }) => useClubDocuments(ids, loadData), {
      initialProps: { ids: ["club-a"] },
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    rerender({ ids: ["club-b"] });
    expect(result.current.status).toBe("loading");
    rerender({ ids: ["club-a"] });
    expect(result.current.status).toBe("loading");
  });

  it("ignores an answer that arrives after unmount", async () => {
    let resolve!: (doc: ClubData) => void;
    const loadData = vi.fn(() => new Promise<ClubData>((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useClubDocuments(["club-a"], loadData));
    unmount();
    await act(async () => resolve(docFor("club-a")));
    expect(result.current.status).toBe("loading");
  });
});

describe("a screen hidden by <Activity>", () => {
  it("keeps its filters and its content when it comes back", async () => {
    clearFanChoice(getBrowserStorage());
    window.localStorage.clear();
    writeFanChoice(window.localStorage, {
      v: 1,
      clubId: "club-a",
      startDate: "2020-01-01",
      startMode: "other",
    });
    const clubs = world["clubs.json"].map(toClubOption);
    const loadData = vi.fn(async (id: string) => docFor(id));

    function Host() {
      const [mode, setMode] = useState<"visible" | "hidden">("visible");
      return (
        <>
          <button onClick={() => setMode(mode === "visible" ? "hidden" : "visible")}>toggle</button>
          <Activity mode={mode}>
            <RivalsScreen clubs={clubs} loadData={loadData} />
          </Activity>
        </>
      );
    }

    render(<Host />);
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByLabelText("Copas nacionales"));
    expect(screen.getByLabelText("Copas nacionales")).toBeChecked();
    await userEvent.click(screen.getByText("toggle"));
    await userEvent.click(screen.getByText("toggle"));
    expect(screen.queryByText("Cargando tu historial…")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("Copas nacionales")).toBeChecked();
  });
});

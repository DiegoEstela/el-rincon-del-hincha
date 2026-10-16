// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAN_STORAGE_KEY,
  clearFanChoice,
  getBrowserStorage,
  parseFanChoice,
  readFanChoice,
  readFanChoiceRaw,
  subscribeFanChoice,
  writeFanChoice,
} from "@/lib/fan-storage";

function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
    ...overrides,
  };
}

const opts = {
  clubIds: new Set(["river-plate", "racing-club"]),
  now: () => new Date("2026-10-16T12:00:00Z"),
};
const choice = {
  v: 1,
  clubId: "river-plate",
  startDate: "1990-05-20",
  startMode: "birth",
} as const;
const raw = (patch: Record<string, unknown> = {}) => JSON.stringify({ ...choice, ...patch });

afterEach(() => {
  clearFanChoice(null);
  vi.restoreAllMocks();
});

describe("write and read", () => {
  it("round-trips a choice", () => {
    const storage = fakeStorage();
    expect(writeFanChoice(storage, choice)).toBe(true);
    expect(storage.getItem(FAN_STORAGE_KEY)).toBe(raw());
    expect(readFanChoice(storage, opts)).toEqual(choice);
  });

  it("returns null when nothing is saved", () => {
    expect(readFanChoice(fakeStorage(), opts)).toBeNull();
  });
});

describe("parseFanChoice", () => {
  it("rejects anything that is not a valid record", () => {
    const bad: (string | null)[] = [
      null,
      "",
      "not json",
      "null",
      "42",
      raw({ v: 2 }),
      raw({ clubId: "deleted-club" }),
      raw({ clubId: 7 }),
      raw({ startDate: "2026-02-30" }),
      raw({ startDate: "2999-01-01" }),
      raw({ startDate: 19900520 }),
      raw({ startDate: " 1990-05-20" }),
      raw({ startMode: "birthday" }),
    ];
    for (const value of bad) expect(parseFanChoice(value, opts)).toBeNull();
  });

  it("accepts the other start mode", () => {
    expect(parseFanChoice(raw({ startMode: "other" }), opts)?.startMode).toBe("other");
  });

  it("does not read the clock when there is nothing to validate", () => {
    const now = vi.fn(() => new Date());
    expect(parseFanChoice(null, { ...opts, now })).toBeNull();
    expect(now).not.toHaveBeenCalled();
  });
});

describe("storage that fails", () => {
  it("treats a throwing getItem as no choice", () => {
    const storage = fakeStorage({
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(readFanChoiceRaw(storage)).toBeNull();
    expect(readFanChoice(storage, opts)).toBeNull();
  });

  it("keeps the choice in memory when setItem throws (quota)", () => {
    const storage = fakeStorage({
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(writeFanChoice(storage, choice)).toBe(false);
    expect(readFanChoice(storage, opts)).toEqual(choice);
  });

  it("works with no storage at all", () => {
    expect(readFanChoice(null, opts)).toBeNull();
    expect(writeFanChoice(null, choice)).toBe(false);
    expect(readFanChoice(null, opts)).toEqual(choice);
  });

  it("forgets the memory copy after a later successful write", () => {
    const storage = fakeStorage();
    writeFanChoice(null, choice);
    expect(writeFanChoice(storage, { ...choice, clubId: "racing-club" })).toBe(true);
    expect(readFanChoice(storage, opts)?.clubId).toBe("racing-club");
  });

  it("returns null storage when the localStorage getter throws", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getBrowserStorage()).toBeNull();
  });

  it("returns the real storage when it is available", () => {
    expect(getBrowserStorage()).toBe(window.localStorage);
  });
});

describe("clearFanChoice", () => {
  it("removes the stored value and the memory copy", () => {
    const storage = fakeStorage();
    writeFanChoice(storage, choice);
    clearFanChoice(storage);
    expect(storage.getItem(FAN_STORAGE_KEY)).toBeNull();
    writeFanChoice(null, choice);
    clearFanChoice(null);
    expect(readFanChoice(null, opts)).toBeNull();
  });

  it("never throws when removeItem throws", () => {
    const storage = fakeStorage({
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => clearFanChoice(storage)).not.toThrow();
  });
});

describe("subscribeFanChoice", () => {
  it("notifies on write and clear and stops after unsubscribe", () => {
    const storage = fakeStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeFanChoice(listener);
    writeFanChoice(storage, choice);
    expect(listener).toHaveBeenCalledTimes(1);
    clearFanChoice(storage);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    writeFanChoice(storage, choice);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

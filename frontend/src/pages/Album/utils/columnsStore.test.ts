import { describe, expect, it } from "vitest";
import { readStoredColumns, storeColumns } from "./columnsStore";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("columnsStore", () => {
  it("round-trips a column count per orientation", () => {
    const storage = memoryStorage();
    storeColumns("portrait", 3, storage);
    storeColumns("landscape", 7, storage);
    expect(readStoredColumns("portrait", storage)).toBe(3);
    expect(readStoredColumns("landscape", storage)).toBe(7);
    expect(storage.map.get("photobin:columns:portrait")).toBe("3");
    expect(storage.map.get("photobin:columns:landscape")).toBe("7");
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredColumns("portrait", memoryStorage())).toBeNull();
  });

  it("returns null for values that are not a positive integer", () => {
    for (const value of ["abc", "NaN", "0", "-2", "2.5", "", "Infinity"]) {
      const storage = memoryStorage({ "photobin:columns:landscape": value });
      expect(readStoredColumns("landscape", storage), value).toBeNull();
    }
  });

  it("survives a storage that throws", () => {
    expect(readStoredColumns("portrait", throwing)).toBeNull();
    expect(() => storeColumns("portrait", 4, throwing)).not.toThrow();
  });
});

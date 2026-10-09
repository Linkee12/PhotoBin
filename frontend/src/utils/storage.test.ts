import { describe, expect, it } from "vitest";
import { readItem, writeItem } from "./storage";

function memoryStorage() {
  const map = new Map<string, string>();
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

describe("storage", () => {
  it("round-trips a value", () => {
    const storage = memoryStorage();
    writeItem("k", "v", storage);
    expect(readItem("k", storage)).toBe("v");
    expect(storage.map.get("k")).toBe("v");
  });

  it("reads null when nothing is stored", () => {
    expect(readItem("k", memoryStorage())).toBeNull();
  });

  it("survives a storage that throws", () => {
    expect(readItem("k", throwing)).toBeNull();
    expect(() => writeItem("k", "v", throwing)).not.toThrow();
  });
});

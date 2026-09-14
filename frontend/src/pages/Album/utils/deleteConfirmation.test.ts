import { describe, expect, it } from "vitest";
import {
  confirmsDeletion,
  DELETE_FALLBACK_PHRASE,
  requiredPhrase,
} from "./deleteConfirmation";

describe("requiredPhrase", () => {
  it("is the album title", () => {
    expect(requiredPhrase("Summer 2026")).toBe("Summer 2026");
  });
  it("falls back to the fixed phrase for an empty title", () => {
    expect(requiredPhrase("")).toBe(DELETE_FALLBACK_PHRASE);
  });
  it("falls back to the fixed phrase for a whitespace-only title", () => {
    expect(requiredPhrase("  \t ")).toBe(DELETE_FALLBACK_PHRASE);
  });
  it("trims the title", () => {
    expect(requiredPhrase("  Summer ")).toBe("Summer");
  });
});

describe("confirmsDeletion", () => {
  it("accepts the exact title", () => {
    expect(confirmsDeletion("Summer 2026", "Summer 2026")).toBe(true);
  });
  it("rejects a case mismatch", () => {
    expect(confirmsDeletion("summer 2026", "Summer 2026")).toBe(false);
  });
  it("rejects a partial match", () => {
    expect(confirmsDeletion("Summer", "Summer 2026")).toBe(false);
  });
  it("ignores surrounding spaces in the input", () => {
    expect(confirmsDeletion("  Summer 2026 ", "Summer 2026")).toBe(true);
  });
  it("accepts the fallback phrase for an untitled album", () => {
    expect(confirmsDeletion(DELETE_FALLBACK_PHRASE, "")).toBe(true);
    expect(confirmsDeletion("", "")).toBe(false);
  });
});

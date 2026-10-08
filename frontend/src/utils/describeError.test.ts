import { describe, expect, it } from "vitest";
import type { CupleError } from "@cuple/react";
import { describeError } from "./describeError";

function error(overrides: Partial<CupleError>): CupleError {
  return {
    kind: "bug",
    message: "Something went wrong.",
    statusCode: null,
    result: null,
    cause: undefined,
    ...overrides,
  };
}

describe("describeError", () => {
  it("blames the connection when nothing answered", () => {
    expect(describeError(error({ kind: "transport" }))).toEqual({
      title: "Can't reach PhotoBin",
      text: "Check your connection, then try again.",
    });
  });

  it("blames the server for a 5xx, without echoing its internals", () => {
    const described = describeError(
      error({ kind: "response", statusCode: 500, message: "ENOSPC: disk full" }),
    );
    expect(described.title).toBe("PhotoBin had a problem");
    expect(described.text).not.toContain("ENOSPC");
  });

  it("shows the server's own message for an unexpected 4xx", () => {
    expect(
      describeError(
        error({
          kind: "response",
          statusCode: 409,
          message: "Someone is editing this photo",
        }),
      ),
    ).toEqual({ title: "That didn't work", text: "Someone is editing this photo" });
  });

  it("asks for a reload after a bug", () => {
    expect(describeError(error({ kind: "bug" })).title).toBe("Something broke");
  });
});

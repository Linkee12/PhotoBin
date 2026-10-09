import type { CupleError } from "@cuple/react";

/** What an error screen says: a headline and one sentence on what to do. */
export type ErrorDescription = { title: string; text: string };

/**
 * Words for an error nobody handled (what reaches a `<Boundary>`). Goes by
 * the kind of failure rather than the message, except for a 4xx, whose
 * message the server wrote for people; a 5xx message may be internals.
 */
export function describeError(error: CupleError): ErrorDescription {
  if (error.kind === "transport") {
    return {
      title: "Can't reach PhotoBin",
      text: "Check your connection, then try again.",
    };
  }
  if (error.kind === "response" && (error.statusCode ?? 500) >= 500) {
    return {
      title: "PhotoBin had a problem",
      text: "The server couldn't finish this. Try again in a moment.",
    };
  }
  if (error.kind === "response") {
    return { title: "That didn't work", text: error.message };
  }
  return {
    title: "Something broke",
    text: "Trying again usually fixes it. Your photos are safe.",
  };
}

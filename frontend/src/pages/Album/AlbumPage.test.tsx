// @vitest-environment jsdom
import { mockCuple, renderWithCuple } from "@cuple/react/testing";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes as RouterRoutes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Routes } from "../../../../backend/src/index";
import type { Metadata } from "../../../../backend/src/services/MetadataService";
import AlbumPage from "./AlbumPage";
import { useAlbumContext } from "./hooks/useAlbumContext";

// The real page needs canvases, workers and observers; the tests are about
// what surrounds it: loading, errors and the album's own outcomes.
vi.mock("./Album", () => ({
  default: function AlbumStub() {
    const { decodedValues, metadata } = useAlbumContext();
    return (
      <h1>
        {decodedValues.albumName} ({metadata.files.length})
      </h1>
    );
  },
}));

const ALBUM_ID = "0b18a801-5878-4b4b-b4f9-20e12a1968d1";

function plainMetadata(name: string): Metadata {
  return { albumId: ALBUM_ID, albumName: { value: btoa(name), iv: "" }, files: [] };
}

/** The client calls a relative `/api/rpc`; the mock server wants a full URL. */
function serve(mock: { fetch: typeof fetch }): typeof fetch {
  return (input, init) => mock.fetch(new URL(String(input), "http://localhost"), init);
}

function renderAlbum() {
  return renderWithCuple(
    <MemoryRouter initialEntries={[`/bin/${ALBUM_ID}`]}>
      <RouterRoutes>
        <Route path="/bin/:albumId" element={<AlbumPage />} />
        <Route path="/not-found" element={<p>not found page</p>} />
      </RouterRoutes>
    </MemoryRouter>,
  );
}

/** Lets suspended reads land and React commit. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  window.location.hash = "";
  // The skeleton is the page's real layout, which asks media queries.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AlbumPage", () => {
  it("shows the skeleton while loading, then the album", async () => {
    let answer!: () => void;
    const mock = mockCuple<Routes>({
      getAlbumMetadata: {
        get: async () => {
          await new Promise<void>((resolve) => (answer = resolve));
          return {
            result: "success",
            statusCode: 200,
            metadata: plainMetadata("Holiday"),
            expiresAt: null,
          };
        },
      },
    });
    vi.stubGlobal("fetch", serve(mock));
    await renderAlbum();
    expect(screen.getByRole("status", { name: "Loading the album" })).toBeTruthy();

    answer();
    await settle();
    expect(screen.getByRole("heading").textContent).toBe("Holiday (0)");
  });

  it("sends a missing album to the not-found page", async () => {
    const mock = mockCuple<Routes>({
      getAlbumMetadata: {
        get: () => ({
          result: "album-not-found",
          statusCode: 404,
          message: "Album not found",
          code: "ALBUM_NOT_FOUND",
        }),
      },
    });
    vi.stubGlobal("fetch", serve(mock));
    await renderAlbum();
    await settle();
    expect(screen.getByText("not found page")).toBeTruthy();
  });

  it("explains an encrypted album opened without its key", async () => {
    const metadata = plainMetadata("c2VjcmV0");
    metadata.albumName.iv = "aXY=";
    const mock = mockCuple<Routes>({
      getAlbumMetadata: {
        get: () => ({ result: "success", statusCode: 200, metadata, expiresAt: null }),
      },
    });
    vi.stubGlobal("fetch", serve(mock));
    await renderAlbum();
    await settle();
    expect(screen.getByRole("heading").textContent).toBe("This link is missing its key");
  });

  it("offers Try again when the server can't be reached, and recovers", async () => {
    let online = false;
    const mock = mockCuple<Routes>({
      getAlbumMetadata: {
        get: () => ({
          result: "success",
          statusCode: 200,
          metadata: plainMetadata("Back"),
          expiresAt: null,
        }),
      },
    });
    vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) =>
      online ? serve(mock)(...args) : Promise.reject(new TypeError("Failed to fetch")),
    );
    await renderAlbum();
    await settle();
    expect(screen.getByRole("heading").textContent).toBe("Can't reach PhotoBin");

    online = true;
    await act(async () => fireEvent.click(screen.getByText("Try again")));
    await settle();
    expect(screen.getByRole("heading").textContent).toBe("Back (0)");
  });
});

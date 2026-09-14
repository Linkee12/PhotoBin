import { createContext, RefObject, useContext, useEffect, useMemo } from "react";
import { ThumbnailLoader } from "../services/ThumbnailLoader";

/** Tiles this far outside the viewport (in viewport heights) are fetched ahead of time. */
const PREFETCH_MARGIN = "100% 0px";

type ThumbnailVisibility = {
  /** Watches a tile; returns the function that stops watching it. */
  observe: (element: Element, fileId: string) => () => void;
};

const ThumbnailVisibilityContext = createContext<ThumbnailVisibility>({
  observe: () => () => undefined,
});

/**
 * Wires one IntersectionObserver to a `ThumbnailLoader`: a tile near the
 * viewport requests its thumbnail, a tile that leaves before the download
 * started withdraws the request. Browsers without IntersectionObserver load
 * everything eagerly.
 */
export function useThumbnailVisibility(loader: ThumbnailLoader): ThumbnailVisibility {
  const visibility = useMemo(() => {
    if (typeof IntersectionObserver === "undefined") {
      return {
        observe: (_element: Element, fileId: string) => {
          loader.request(fileId);
          return () => undefined;
        },
        disconnect: () => undefined,
      };
    }
    const ids = new Map<Element, string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const fileId = ids.get(entry.target);
          if (fileId === undefined) continue;
          if (entry.isIntersecting) loader.request(fileId);
          else loader.cancel(fileId);
        }
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    return {
      observe: (element: Element, fileId: string) => {
        ids.set(element, fileId);
        observer.observe(element);
        return () => {
          ids.delete(element);
          observer.unobserve(element);
          loader.cancel(fileId);
        };
      },
      disconnect: () => observer.disconnect(),
    };
  }, [loader]);
  useEffect(() => () => visibility.disconnect(), [visibility]);
  return visibility;
}

export const ThumbnailVisibilityProvider = ThumbnailVisibilityContext.Provider;

/** Requests the tile's thumbnail while it is near the viewport and still unloaded. */
export function useThumbnailRequest(
  ref: RefObject<Element | null>,
  fileId: string,
  enabled: boolean,
) {
  const { observe } = useContext(ThumbnailVisibilityContext);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || element === null) return;
    return observe(element, fileId);
  }, [observe, fileId, enabled]);
}

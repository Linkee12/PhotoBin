import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { imageQueryService } from "../services";
import { AlbumFile, Rotation, viewerPart } from "../services/renditions";

type Size = { width: number; height: number };

/** 1x1 GIF: what the viewer shows when the grid has no thumbnail for a file. */
const PLACEHOLDER_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

/**
 * What the viewer has loaded for `fileId`. Every object URL in here was
 * created by the viewer and lives exactly as long as some `Media` value in
 * state references it (see `useOwnedObjectUrls`); thumbnails belong to the grid.
 */
type Media = { fileId: string } & (
  | {
      kind: "image";
      url: string;
      /** Quarter turns already baked into `url`'s pixels. */
      bakedRotation: Rotation;
      naturalSize: Size;
      fileName: string;
      /** Only for videos; `url` is then the poster frame. */
      video?: { status: "loading" } | { status: "ready"; url: string };
    }
  | { kind: "unsupported"; downloadUrl: string; fileName: string }
  | { kind: "missing" }
);

function ownedUrls(media: Media | undefined): string[] {
  if (!media) return [];
  switch (media.kind) {
    case "image":
      return media.video?.status === "ready" ? [media.url, media.video.url] : [media.url];
    case "unsupported":
      return [media.downloadUrl];
    case "missing":
      return [];
  }
}

/**
 * The single place object URLs are revoked: a URL goes exactly once, when it
 * drops out of the owned set (superseded) or on unmount — never while any
 * slot still references it. The set dedupes aliases (a video's download URL
 * is its display URL).
 */
function useOwnedObjectUrls(urls: string[]) {
  const held = useRef(new Set<string>());
  useEffect(() => {
    const next = new Set(urls);
    for (const url of held.current) if (!next.has(url)) URL.revokeObjectURL(url);
    held.current = next;
  }, [urls]);
  useEffect(() => {
    const set = held.current;
    return () => {
      for (const url of set) URL.revokeObjectURL(url);
      set.clear();
    };
  }, []);
}

/** Decodes `src` up front so swapping it into the <img> paints in the same frame. */
async function decodeImage(src: string): Promise<Size> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    // e.g. a GIF placeholder that cannot be decoded; fall through with whatever we have.
  }
  return { width: img.naturalWidth, height: img.naturalHeight };
}

type Options = {
  fileId: string;
  file: AlbumFile | undefined;
  albumId: string | undefined;
  key: string | null;
  /** The grid's already-decoded thumbnail for `fileId`, shown while the real image loads. */
  gridThumbnail: string | undefined;
  /** An image whose pixels carry `bakedRotation` was swapped in (same render as the swap). */
  onImageSwapped: (bakedRotation: Rotation) => void;
};

/**
 * Loads what the full-screen viewer shows for one file: the rendition that
 * feeds the viewer (see `viewerPart`), then the video for videos, or only a
 * download URL for unsupported files. Until the file's own image has been
 * decoded the viewer is "switching" and draws the grid thumbnail instead, so
 * opening or stepping to a photo never blinks.
 */
export function useViewerMedia(options: Options) {
  const { fileId, file, albumId, key, gridThumbnail } = options;
  const [media, setMedia] = useState<Media>();
  // The effect must read the latest `file` without depending on the object:
  // a metadata refresh that changes no part iv must not refetch.
  const readFile = useEffectEvent(() => file);
  const onImageSwapped = useEffectEvent(options.onImageSwapped);

  useEffect(() => {
    let cancelled = false;
    // Hands a fresh URL over to state — or, if this run was cancelled while
    // the fetch was in flight, revokes it right away so it is never shown nor leaked.
    const publish = (next: Media, freshUrl?: string) => {
      if (!cancelled) setMedia(next);
      else if (freshUrl) URL.revokeObjectURL(freshUrl);
      return !cancelled;
    };

    const load = async () => {
      const file = readFile();
      if (albumId === undefined || file === undefined) return;
      if (!file.original) {
        if (!file.unsupportedFile) return publish({ kind: "missing", fileId });
        const res = await imageQueryService.getImg(albumId, file, key, "unsupportedFile");
        if (!res) return publish({ kind: "missing", fileId });
        const downloadUrl = URL.createObjectURL(res.blob);
        return publish(
          { kind: "unsupported", fileId, downloadUrl, fileName: res.fileName },
          downloadUrl,
        );
      }

      const part = viewerPart(file);
      const res = await imageQueryService.getImg(albumId, file, key, part.type);
      if (!res) return publish({ kind: "missing", fileId });
      const url = URL.createObjectURL(res.blob);
      const naturalSize = await decodeImage(url);
      const image: Media = {
        kind: "image",
        fileId,
        url,
        bakedRotation: part.rotation,
        naturalSize,
        fileName: res.fileName,
        video: file.originalVideo ? { status: "loading" } : undefined,
      };
      if (!cancelled) onImageSwapped(part.rotation);
      if (!publish(image, url) || !file.originalVideo) return;

      // The image stays mounted as the poster underneath.
      const video = await imageQueryService.getImg(albumId, file, key, "originalVideo");
      if (!video) return publish({ ...image, video: undefined });
      const videoUrl = URL.createObjectURL(video.blob);
      publish({ ...image, video: { status: "ready", url: videoUrl } }, videoUrl);
    };

    load().catch((e) => {
      if (cancelled) return;
      console.error(e);
      setMedia((prev) =>
        prev?.fileId === fileId && prev.kind === "image"
          ? { ...prev, video: undefined }
          : prev,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    fileId,
    albumId,
    key,
    // Only the parts the viewer can read; a rename or batch edit leaves these untouched.
    file?.reduced?.iv,
    file?.edited?.iv,
    file?.originalVideo?.iv,
    file?.unsupportedFile?.iv,
  ]);

  useOwnedObjectUrls(useMemo(() => ownedUrls(media), [media]));

  // Switching is derived, not stored: until the new file's own image has been
  // decoded, `media` still belongs to the previous file.
  const isSwitching = media?.fileId !== fileId;
  const loaded = isSwitching ? undefined : media;
  const image = loaded?.kind === "image" ? loaded : undefined;
  const videoUrl = image?.video?.status === "ready" ? image.video.url : undefined;

  return {
    isSwitching,
    /** `<img src>`: the thumbnail (or placeholder) while switching, then the fetched rendition. */
    shownUrl: isSwitching ? (gridThumbnail ?? PLACEHOLDER_GIF) : (image?.url ?? ""),
    naturalSize: image?.naturalSize ?? { width: 0, height: 0 },
    fileName: loaded && loaded.kind !== "missing" ? loaded.fileName : "",
    isLoadingVideo: image?.video?.status === "loading",
    videoUrl,
    /** Video or unsupported-file blob; undefined while it is still being prepared. */
    downloadUrl: loaded?.kind === "unsupported" ? loaded.downloadUrl : videoUrl,
  };
}

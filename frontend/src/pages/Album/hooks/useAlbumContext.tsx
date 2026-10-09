import { combine, useGet } from "@cuple/react";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, useNavigate } from "react-router";
import { client, store } from "../../../cuple";
import {
  forgetVisitedAlbum,
  rememberVisitedAlbum,
} from "../../../services/visitedAlbums";
import { cryptoService } from "../services";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { DecodedBatches, DecodedFiles } from "../utils/groupFiles";
import { PrimaryButton } from "../../Home/Home";
import { StatusButtonLabel, StatusScreen } from "../../../components/StatusScreen";

export type DecodedValues = {
  albumName: string;
  /** Decrypted file name and date by fileId. */
  files: DecodedFiles;
  /** Decrypted batch name (and its timestamp) by batchId. */
  batches: DecodedBatches;
};

export type AlbumContextType = {
  albumId: string;
  /** AES-GCM key from the URL hash, or `null` for a plain (unencrypted) album. */
  key: string | null;
  isEncrypted: boolean;
  metadata: Metadata;
  expiresAt: number | null;
  decodedValues: DecodedValues;
  /** Re-fetches the metadata; the album stays on screen until the new one is decrypted. */
  refreshMetadata: () => void;
};

const AlbumContext = createContext<AlbumContextType | null>(null);

export function useAlbumContext() {
  const albumContext = useContext(AlbumContext);
  if (albumContext === null) {
    throw new Error("useAlbumContext must be used inside AlbumContextProvider");
  }
  return albumContext;
}

/** Empty or missing hash means the album was created without encryption. */
function getKeyFromHash(): string | null {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  return hash.length === 0 ? null : hash;
}

/**
 * Plain albums store every value with an empty iv. A non-empty iv means the
 * album was encrypted, so opening it without a key must fail instead of
 * rendering the ciphertext as if it were plaintext.
 */
function hasEncryptedValues(metadata: Metadata): boolean {
  if (metadata.albumName.iv !== "") return true;
  if (Object.values(metadata.batches ?? {}).some((batch) => batch.name.iv !== ""))
    return true;
  return metadata.files.some((file) => file.fileName.iv !== "" || file.date.iv !== "");
}

async function decodeMetadata(metadata: Metadata, key: string | null) {
  const decrypt = (entry: { value: string; iv: string }) =>
    cryptoService.decryptText(entry.value, key, entry.iv);
  const [albumName, files, batches] = await Promise.all([
    decrypt(metadata.albumName),
    Promise.all(
      metadata.files.map(async (file) => {
        const [name, date] = await Promise.all([
          decrypt(file.fileName),
          decrypt(file.date),
        ]);
        return [file.fileId, { name, date }] as const;
      }),
    ),
    Promise.all(
      Object.entries(metadata.batches ?? {}).map(async ([batchId, batch]) => {
        try {
          const name = await decrypt(batch.name);
          return [batchId, { name, createdAt: batch.createdAt }] as const;
        } catch (error) {
          // A batch whose name cannot be decoded still groups its files
          // (under a placeholder title); it must not take the album down.
          console.warn(`[album] could not decode the name of batch ${batchId}`, error);
          return undefined;
        }
      }),
    ),
  ]);
  return {
    albumName,
    files: Object.fromEntries(files),
    batches: Object.fromEntries(batches.filter((b) => b !== undefined)),
  };
}

/**
 * The album as the page sees it: fetched, checked against the key and
 * decrypted, in one cached read. `useGet` suspends until it is ready (the
 * page's `<Boundary>` shows the skeleton), and a refresh keeps the current
 * album on screen until the new one is decrypted, so overlapping refreshes
 * (one per finalized file during an upload) never roll the list back.
 *
 * An album that does not exist, or a link that cannot open it, is a value
 * here, not an error: each gets its own screen.
 */
export const albumMetadata = combine(
  async (ctx, args: { albumId: string; key: string | null }) => {
    const response = await ctx.get(
      client.getAlbumMetadata,
      { query: { id: args.albumId } },
      // Expired, deleted (by anyone with the link) or not an album id at all.
      { resolveAlso: ["album-not-found", "invalid-query"] },
    );
    if (response.result !== "success") return { result: "missing" } as const;
    const { metadata, expiresAt } = response;
    if (args.key === null && hasEncryptedValues(metadata)) {
      return { result: "missing-key" } as const;
    }
    let decodedValues: DecodedValues;
    try {
      decodedValues = await decodeMetadata(metadata, args.key);
    } catch (error) {
      console.error("[album] could not decrypt the metadata", error);
      return { result: "wrong-key" } as const;
    }
    return { result: "success", metadata, expiresAt, decodedValues } as const;
  },
);

/**
 * What a change to an album refreshes: the endpoint, which re-runs every
 * `albumMetadata` read of it. (Naming only the combined read would re-run it
 * over the cached response.)
 */
export const ALBUM_REFRESH = [client.getAlbumMetadata];

/** Re-fetches every album the page shows; the store keeps the old one visible meanwhile. */
export function refreshAlbumMetadata() {
  return store.refresh(ALBUM_REFRESH);
}

/** Suspends while the album loads; render it inside a `<Boundary>`. */
export function AlbumContextProvider(props: { albumId: string; children: ReactNode }) {
  // Read once: the hash is the key, and it does not change while the page is open.
  const [key] = useState(getKeyFromHash);
  const album = useGet(albumMetadata, { albumId: props.albumId, key });

  useEffect(() => {
    if (album.result !== "success") return;
    rememberVisitedAlbum({
      albumId: props.albumId,
      url: window.location.href,
      title: album.decodedValues.albumName,
      expiresAt: album.expiresAt,
      itemCount: album.metadata.files.length,
    });
  }, [album, props.albumId]);

  const value = useMemo((): AlbumContextType | null => {
    if (album.result !== "success") return null;
    return {
      albumId: props.albumId,
      key,
      isEncrypted: key !== null,
      metadata: album.metadata,
      expiresAt: album.expiresAt,
      decodedValues: album.decodedValues,
      refreshMetadata: () => void refreshAlbumMetadata(),
    };
  }, [album, key, props.albumId]);

  if (album.result === "missing") return <AlbumGone albumId={props.albumId} />;
  if (album.result === "missing-key" || album.result === "wrong-key") {
    return <UnreadableLink missingKey={album.result === "missing-key"} />;
  }
  return <AlbumContext.Provider value={value}>{props.children}</AlbumContext.Provider>;
}

/**
 * An album with nothing known yet but what this browser remembers, for the
 * loading skeleton: it renders the page's real components, which read this.
 */
export function AlbumPlaceholderProvider(props: {
  albumId: string;
  expiresAt: number | null;
  children: ReactNode;
}) {
  const [key] = useState(getKeyFromHash);
  const value = useMemo(
    (): AlbumContextType => ({
      albumId: props.albumId,
      key,
      isEncrypted: key !== null,
      metadata: {
        albumId: props.albumId,
        albumName: { value: "", iv: "" },
        files: [],
      },
      expiresAt: props.expiresAt,
      decodedValues: { albumName: "", files: {}, batches: {} },
      refreshMetadata: () => undefined,
    }),
    [key, props.albumId, props.expiresAt],
  );
  return <AlbumContext.Provider value={value}>{props.children}</AlbumContext.Provider>;
}

/** The album is gone (expired, deleted, or never existed): forget it and say so. */
function AlbumGone(props: { albumId: string }) {
  useEffect(() => forgetVisitedAlbum(props.albumId), [props.albumId]);
  return <Navigate to="/not-found" replace />;
}

/** The album exists, but this link cannot decrypt it. */
function UnreadableLink(props: { missingKey: boolean }) {
  const navigate = useNavigate();
  return (
    <StatusScreen
      title={
        props.missingKey
          ? "This link is missing its key"
          : "This link can't open the album"
      }
      text={
        props.missingKey
          ? "The album is encrypted, and the part of the link after # unlocks it. Ask for the whole link."
          : "The key in this link doesn't match the album, so its photos can't be decrypted. Ask for the link again."
      }
    >
      <PrimaryButton type="button" onClick={() => navigate("/")}>
        <StatusButtonLabel>Go back home</StatusButtonLabel>
      </PrimaryButton>
    </StatusScreen>
  );
}

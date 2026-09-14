/* eslint-disable promise/always-return */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { client } from "../../../cuple";
import { cryptoService } from "../services";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { toast } from "react-toastify";
import { DecodedBatches, DecodedFiles } from "../utils/groupFiles";
import { rememberVisitedAlbum } from "../../../services/visitedAlbums";

export type DecodedValues = {
  albumName: string;
  /** Decrypted file name and date by fileId. */
  files: DecodedFiles;
  /** Decrypted batch name (and its timestamp) by batchId. */
  batches: DecodedBatches;
};

const EMPTY_DECODED: DecodedValues = { albumName: "", files: {}, batches: {} };

export type AlbumContextType = {
  /** AES-GCM key from the URL hash, or `null` for a plain (unencrypted) album. */
  key: string | null;
  isEncrypted: boolean;
  metadata: Metadata | undefined;
  expiresAt: number | null;
  decodedValues: DecodedValues;
  refreshMetadata: () => void;
};

const AlbumContext = createContext<AlbumContextType>({
  key: null,
  isEncrypted: false,
  metadata: undefined,
  expiresAt: null,
  decodedValues: EMPTY_DECODED,
  refreshMetadata: () => undefined,
});

export function useAlbumContext() {
  const albumContext = useContext(AlbumContext);
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

export function AlbumContextProvider(props: { children: React.ReactNode }) {
  const { albumId } = useParams();
  const key = getKeyFromHash();
  const [metadata, setMetadata] = useState<Metadata>();
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [decodedValues, setDecodedValues] = useState<DecodedValues>(EMPTY_DECODED);
  // Refreshes can overlap (one per finalized file during an upload); only the
  // latest request may update the state so a slow older response cannot
  // roll back a newer file list.
  const latestRequest = useRef(0);

  const refreshMetadataAsync = async () => {
    if (!albumId) return;
    const request = ++latestRequest.current;
    const response = await client.getAlbumMetadata.get({
      query: {
        id: albumId,
      },
    });
    if (response.result === "success") {
      if (key === null && hasEncryptedValues(response.metadata)) {
        throw new Error("This album is encrypted, but the link is missing its key");
      }
      const decoded = await decodeMetadata(response.metadata, key);
      if (request !== latestRequest.current) return;
      setMetadata(response.metadata);
      setExpiresAt(response.expiresAt);
      setDecodedValues(decoded);
      rememberVisitedAlbum({
        albumId,
        url: window.location.href,
        title: decoded.albumName,
        expiresAt: response.expiresAt,
        itemCount: response.metadata.files.length,
      });
    }
  };
  const refreshMetadata = () => {
    refreshMetadataAsync().catch((error) => {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load album");
      setMetadata(() => {
        throw error;
      });
    });
  };

  useEffect(() => {
    refreshMetadata();
  }, []);
  return (
    <AlbumContext.Provider
      value={{
        refreshMetadata,
        key,
        isEncrypted: key !== null,
        metadata,
        expiresAt,
        decodedValues,
      }}
    >
      {props.children}
    </AlbumContext.Provider>
  );
}

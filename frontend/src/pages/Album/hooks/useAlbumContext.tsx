/* eslint-disable promise/always-return */
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router";
import { client } from "../../../cuple";
import { CryptoService } from "../services/CryptoService";
import { Metadata } from "../../../../../backend/src/services/MetadataService";
import { toast } from "react-toastify";

export type DecodedValues = {
  albumName: string;
};

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
  decodedValues: { albumName: "" },
  refreshMetadata: () => undefined,
});

export function useAlbumContext() {
  const albumContext = useContext(AlbumContext);
  return albumContext;
}

const cryptoService = new CryptoService();

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
  return metadata.files.some((file) => file.fileName.iv !== "" || file.date.iv !== "");
}

export function AlbumContextProvider(props: { children: React.ReactNode }) {
  const { albumId } = useParams();
  const key = getKeyFromHash();
  const [metadata, setMetadata] = useState<Metadata>();
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [name, setName] = useState("");

  const refreshMetadataAsync = async () => {
    if (!albumId) return;
    const response = await client.getAlbumMetadata.get({
      query: {
        id: albumId,
      },
    });
    if (response.result === "success") {
      if (key === null && hasEncryptedValues(response.metadata)) {
        throw new Error("This album is encrypted, but the link is missing its key");
      }
      const name = await cryptoService.decryptText(
        response.metadata.albumName.value,
        key,
        response.metadata.albumName.iv,
      );
      setMetadata(response.metadata);
      setExpiresAt(response.expiresAt);
      setName(name);
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
        decodedValues: { albumName: name },
      }}
    >
      {props.children}
    </AlbumContext.Provider>
  );
}

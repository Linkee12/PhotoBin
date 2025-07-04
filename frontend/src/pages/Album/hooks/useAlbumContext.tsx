/* eslint-disable promise/always-return */
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router";
import { client } from "../../../cuple";
import { CryptoService } from "../services/CryptoService";
import { Metadata } from "../../../../../backend/src/services/MetadataService";

export type DecodedValues = {
  albumName: string;
};

export type AlbumContextType = {
  key: string;
  metadata: Metadata | undefined;
  decodedValues: DecodedValues;
  refreshMetadata: () => void;
};

const AlbumContext = createContext<AlbumContextType>({
  key: "",
  metadata: undefined,
  decodedValues: { albumName: "" },
  refreshMetadata: () => undefined,
});

export function useAlbumContext() {
  const albumContext = useContext(AlbumContext);
  return albumContext;
}

const cryptoService = new CryptoService();

export function AlbumContextProvider(props: { children: React.ReactNode }) {
  const { albumId } = useParams();
  const key = decodeURIComponent(window.location.hash.slice(1));
  const [metadata, setMetadata] = useState<Metadata>();
  const [name, setName] = useState("");

  const refreshMetadataAsync = async () => {
    if (!albumId || !key) return;
    const response = await client.getAlbumMetadata.get({
      query: {
        id: albumId,
      },
    });
    if (response.result === "success") {
      const name = await cryptoService.decryptText(
        response.metadata.albumName.value,
        key,
        response.metadata.albumName.iv,
      );
      setMetadata(response.metadata);
      setName(name);
    }
  };
  const refreshMetadata = () => {
    refreshMetadataAsync().catch((error) => {
      console.error(error);
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
      value={{ refreshMetadata, key, metadata, decodedValues: { albumName: name } }}
    >
      {props.children}
    </AlbumContext.Provider>
  );
}

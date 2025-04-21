/* eslint-disable promise/always-return */
import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router";
import { client } from "../../../cuple";

export type Metadata = {
  albumId: string;
  albumName: string;
  files: {
    fileId: string;
    originalIv: string;
    reducedIv: string;
    thumbnailIv: string;
    chunks: { reduced: number; original: number; thumbnail: number };
  }[];
};

export type AlbumContextType = {
  key: string;
  metadata: Metadata | undefined;
  refreshMetadata: () => void;
};

const AlbumContext = createContext<AlbumContextType>({
  key: "",
  metadata: undefined,
  refreshMetadata: () => undefined,
});

export function useAlbumContext() {
  const albumContext = useContext(AlbumContext);
  return albumContext;
}

export function AlbumContextProvider(props: { children: React.ReactNode }) {
  const { albumId } = useParams();
  const key = decodeURIComponent(window.location.hash.slice(1));
  const [metadata, setMetadata] = useState<Metadata>();

  const refreshMetadata = () => {
    if (!albumId || !key) return;
    client.getAlbumMetadata
      .get({
        query: {
          id: albumId,
        },
      })
      .then((response) => {
        if (response.result === "success") {
          setMetadata(response.metadata);
        }
      })
      .catch((e) => {
        console.error(e);
        setMetadata(() => {
          throw e;
        });
      });
  };

  useEffect(() => {
    refreshMetadata();
  }, []);

  return (
    <AlbumContext.Provider value={{ refreshMetadata, key, metadata }}>
      {props.children}
    </AlbumContext.Provider>
  );
}

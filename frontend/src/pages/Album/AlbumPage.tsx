import { Boundary } from "@cuple/react";
import { useParams } from "react-router";
import { ErrorScreen } from "../../components/ErrorScreen";
import Album from "./Album";
import { AlbumSkeleton } from "./components/AlbumSkeleton";
import { AlbumContextProvider } from "./hooks/useAlbumContext";

/**
 * `/bin/:albumId`: the skeleton while the album loads and decrypts, an error
 * screen with Try again if that fails, then the album. Keyed by the album, so
 * opening another one starts fresh.
 */
export default function AlbumPage() {
  const { albumId = "" } = useParams();
  return (
    <Boundary
      key={albumId}
      fallback={<AlbumSkeleton />}
      error={(error, retry) => <ErrorScreen error={error} onRetry={retry} />}
    >
      <AlbumContextProvider albumId={albumId}>
        <Album />
      </AlbumContextProvider>
    </Boundary>
  );
}

import { Skeleton } from "../../../components/Skeleton";
import { styled } from "../../../stitches.config";
import { SHELF_COLOR, TOOLBAR_HEIGHT } from "../layout";

const TILES = 12;

/**
 * The album page while its metadata loads and decrypts: the header's title
 * and meta line, the toolbar shelf and a grid of 3:2 tiles laid out like the
 * real grid, so the page does not jump when the album appears.
 */
export function AlbumSkeleton() {
  return (
    <Page role="status" aria-busy="true" aria-label="Loading the album">
      <Header>
        <Skeleton css={{ width: "min(14em, 70%)", height: "2.4rem" }} />
        <Skeleton css={{ width: "9em", height: "1rem", marginTop: "1rem" }} />
      </Header>
      <Shelf>
        <Skeleton css={{ width: "8em", height: "2.25rem", borderRadius: "1.5rem" }} />
        <Skeleton css={{ width: "8em", height: "2.25rem", borderRadius: "1.5rem" }} />
      </Shelf>
      <Grid>
        {Array.from({ length: TILES }, (_, i) => (
          <Tile key={i} css={{ animationDelay: `${(i % 4) * 120}ms` }} />
        ))}
      </Grid>
    </Page>
  );
}

const Page = styled("div", {
  minHeight: "100dvh",
  background: "#181818",
  fontFamily: "Open Sans",
  overflow: "hidden",
});

const Header = styled("div", {
  padding: "2rem 2rem 2.5rem",
  minHeight: "9rem",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
});

const Shelf = styled("div", {
  background: SHELF_COLOR,
  minHeight: TOOLBAR_HEIGHT,
  boxSizing: "border-box",
  padding: "0 2rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.75rem",
  "@narrow": { minHeight: "3rem", justifyContent: "center" },
});

const Grid = styled("div", {
  "@narrow": {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    margin: "1rem 1.28rem",
  },
  "@wide": {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "20px",
    margin: "2rem",
  },
});

const Tile = styled(Skeleton, {
  width: "100%",
  aspectRatio: "3 / 2",
  borderRadius: "0.75rem",
});

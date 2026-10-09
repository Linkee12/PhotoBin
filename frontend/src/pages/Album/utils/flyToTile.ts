import { prefersReducedMotion } from "../../../utils/reducedMotion";
import { containRect, Rect, Size } from "./pinchGrid";

/** How long the photo takes to fly back into its tile. */
const FLIGHT_MS = 320;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** The tile's corner radius (`AlbumItem`). */
const TILE_RADIUS = "10px";
/** Above the album, where the viewer was (its `zIndex` is 9). */
const FLIGHT_Z_INDEX = 9;

/**
 * Where the viewer draws the photo, unrotated: `box` is the `<img>`'s
 * on-screen bounds (zoom and any CSS quarter turns included), in which the
 * picture is `object-fit: contain`ed. For an odd number of quarter turns the
 * bounds are the turned element's, so its own box is them swapped.
 */
export function shownPicture(box: Rect, natural: Size, quarterTurns: number): Rect {
  const turned = Math.abs(quarterTurns) % 2 === 1;
  const element = turned
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
  const drawn = containRect(natural, element);
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  return {
    left: centerX - drawn.width / 2,
    top: centerY - drawn.height / 2,
    width: drawn.width,
    height: drawn.height,
  };
}

/**
 * Flies the photo the viewer just closed on back into its grid tile: a copy
 * of the picture starts where the viewer drew it and shrinks into the tile,
 * cropping to the tile's 3:2 on the way (`object-fit: cover`), while a black
 * backdrop fades from `backdropOpacity` to nothing. The tile is scrolled into
 * view first (the viewer may have stepped far from where it was opened) and
 * hidden until the copy lands on it. Without a tile on screen the copy fades.
 * Call it right after the viewer was hidden; it waits for that to be laid out.
 */
export function flyToTile(options: {
  fileId: string;
  src: string;
  from: Rect;
  quarterTurns: number;
  backdropOpacity: number;
}) {
  if (prefersReducedMotion() || options.src === "") return;
  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    background: "#000",
    opacity: String(options.backdropOpacity),
    zIndex: String(FLIGHT_Z_INDEX),
    pointerEvents: "none",
  });
  const picture = document.createElement("img");
  picture.src = options.src;
  picture.alt = "";
  Object.assign(picture.style, {
    position: "fixed",
    ...px(options.from),
    objectFit: "cover",
    transform: `rotate(${options.quarterTurns * 90}deg)`,
    zIndex: String(FLIGHT_Z_INDEX),
    pointerEvents: "none",
  });
  document.body.append(backdrop, picture);

  // The viewer's hiding and the page's scroll being given back are laid out
  // by the next frame.
  requestAnimationFrame(() => {
    const tile = document.querySelector<HTMLElement>(
      `[data-tile="${CSS.escape(options.fileId)}"]`,
    );
    tile?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    const to = tile && onScreen(tile.getBoundingClientRect());
    if (tile && to) tile.style.visibility = "hidden";
    const timing = { duration: FLIGHT_MS, easing: EASING, fill: "forwards" as const };
    backdrop.animate([{ opacity: options.backdropOpacity }, { opacity: 0 }], timing);
    const flight = picture.animate(
      to
        ? [
            {
              ...px(options.from),
              borderRadius: "0px",
              transform: picture.style.transform,
            },
            { ...px(to), borderRadius: TILE_RADIUS, transform: "rotate(0deg)" },
          ]
        : [
            { opacity: 1, transform: picture.style.transform },
            { opacity: 0, transform: `${picture.style.transform} scale(0.9)` },
          ],
      timing,
    );
    const land = () => {
      if (tile) tile.style.visibility = "";
      picture.remove();
      backdrop.remove();
    };
    flight.finished.then(land, land);
  });
}

function px(rect: Rect) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

/** The tile's rect, if any of it is in the viewport (a collapsed group's tiles are not rendered). */
function onScreen(rect: DOMRect): Rect | undefined {
  const visible =
    rect.width > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;
  return visible
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : undefined;
}

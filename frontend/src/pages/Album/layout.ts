/** Colours and sizes shared by the album toolbar and the group panels. */

/** Background of the toolbar shelf and the narrow bottom sheet. */
export const SHELF_COLOR = "#0E0E0E";
/** Height of every toolbar control: the view toggle and the buttons. */
export const CONTROL_HEIGHT = "2.25rem";
/** Ground and the two alternating group body colours (see `PanelVariant`). */
export const PANEL_COLORS = ["#181818", "#333333", "#666666"] as const;
/** Least height of the wide toolbar row; the first group's header may make it taller. */
export const TOOLBAR_HEIGHT = "5rem";
/** Height of the bottom-sheet's closed bar; the first group's header sits on it. */
export const SHEET_BAR_HEIGHT = "3rem";
/**
 * Vertical span of every curve drawn with `albumItemsBg` outside the wide
 * toolbar: the sheet's handle and the water of each group band. Equal spans
 * keep the curves parallel, so the shelf between the handle and the first
 * band's water has the same thickness along its whole width.
 */
export const WAVE_HEIGHT = SHEET_BAR_HEIGHT;

/** How far below the header edge the sun's centre lies (inside the toolbar band). */
export const SUN_CENTER_BELOW_HEADER = "2.2rem";
/** Horizontal position of the sun behind the album header, per toolbar form. */
export const SUN_X = { inline: "25%", stacked: "30%" } as const;
/**
 * The landing page's sun with a much fainter glow, drawn on a `ground`-coloured
 * box with its centre at `centerY` and `x`. The header and the toolbar band each
 * paint their part of the same disc so it sets behind the album's wave.
 */
export function sunBackground(ground: string, x: string, centerY: string) {
  return (
    `radial-gradient(circle 3rem at ${x} ${centerY}, #ffa021 99%, transparent 100%), ` +
    `radial-gradient(circle 9rem at ${x} ${centerY}, #3a2a17 0%, ${ground} 100%)`
  );
}

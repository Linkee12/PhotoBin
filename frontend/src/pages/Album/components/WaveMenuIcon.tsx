import { useLayoutEffect, useRef, useState } from "react";
import { styled } from "../../../stitches.config";

/**
 * The wave of `albumItemsBg.svg` in its own coordinates (viewBox 94.87 × 12.41,
 * the path's transforms applied): from the bottom-right corner up to the
 * top-left. The sheet's handle stretches it over the whole viewport width and
 * `WAVE_HEIGHT`.
 */
const WAVE_WIDTH = 94.8698;
const WAVE_HEIGHT_UNITS = 12.4057;
const WAVE_PATH =
  "M 94.8698,12.4057 C 78.3746,12.4057 63.7399,6.8103 48.4528,3.7273 " +
  "C 32.9841,0.6076 16.86,0 -0.3802,0";

/** Gap between the bars and their stroke width, in px. */
const BAR_GAP_PX = 7;
const BAR_WIDTH_PX = 2;

type WaveMenuIconProps = {
  /** Width of the icon in px. */
  width: number;
  /** Height the wave is stretched to, in px (the handle's height). */
  waveHeight: number;
  /** Height of the icon's box in px; the bars are centred `centerBelowCurve` px below the curve. */
  height: number;
  centerBelowCurve: number;
  className?: string;
};

/**
 * Hamburger icon for the collapsed bottom sheet: three bars that are the
 * middle section of the handle's wave, each a copy of the curve shifted down,
 * so they run parallel to the shelf's edge above them at any viewport width.
 * The icon is a window of the stretched wave as wide as the icon itself, so
 * its parent must be the element the wave is stretched over (it measures
 * that element's width).
 */
export function WaveMenuIcon(props: WaveMenuIconProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [stretchedWidth, setStretchedWidth] = useState(0);

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(([entry]) =>
      setStretchedWidth(entry.contentRect.width),
    );
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  if (stretchedWidth === 0) return <Svg ref={ref} className={props.className} />;
  // The window: as wide as the icon in wave units, centred on the wave.
  const windowWidth = (WAVE_WIDTH * props.width) / stretchedWidth;
  const unitsPerPx = WAVE_HEIGHT_UNITS / props.waveHeight;
  const offsets = [-BAR_GAP_PX, 0, BAR_GAP_PX].map((d) => props.centerBelowCurve + d);
  return (
    <Svg
      ref={ref}
      className={props.className}
      width={props.width}
      height={props.height}
      viewBox={`${(WAVE_WIDTH - windowWidth) / 2} 0 ${windowWidth} ${props.height * unitsPerPx}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {offsets.map((offset) => (
        <path
          key={offset}
          d={WAVE_PATH}
          transform={`translate(0 ${offset * unitsPerPx})`}
          fill="none"
          stroke="currentColor"
          strokeWidth={BAR_WIDTH_PX}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </Svg>
  );
}

const Svg = styled("svg", {
  display: "block",
  overflow: "hidden",
  color: "#fff",
});

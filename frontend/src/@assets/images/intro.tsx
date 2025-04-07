import { interpolate } from "flubber";
import { animate, motion, MotionValue, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";
const IntroImg = () => {
  const [pathIndex, setPathIndex] = useState(0);
  const progress = useMotionValue(pathIndex);
  const path = useFlubber(progress, PATHS);

  useEffect(() => {
    const interval = setInterval(() => {
      setPathIndex((prev) => (prev + 1) % PATHS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const animation = animate(progress, pathIndex, {
      duration: 1,
      ease: "easeInOut",
    });
    return () => {
      animation.stop();
    };
  }, [pathIndex]);
  return (
    <svg
      width={500}
      height={200}
      viewBox="0 0 264.71527 93.359299"
      id="svg1"
      xmlSpace="preserve"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs id="defs1">
        <linearGradient id="linearGradient79">
          <stop
            style={{
              stopColor: "#ffa021",
              stopOpacity: 1,
            }}
            offset={0.13681495}
            id="stop77"
          />
          <stop
            style={{
              stopColor: "#9d6e2f",
              stopOpacity: 1,
            }}
            offset={0.13681495}
            id="stop78"
          />
          <stop
            style={{
              stopColor: "#ffffff",
              stopOpacity: 1,
            }}
            offset={1}
            id="stop79"
          />
        </linearGradient>
        <radialGradient
          xlinkHref="#linearGradient79"
          id="radialGradient75"
          cx={8.5768938}
          cy={17.930445}
          fx={8.5768938}
          fy={17.930445}
          r={8}
          gradientTransform="matrix(5.1304707,0.01166441,-0.01250241,5.4989578,-39.779328,-76.698805)"
          gradientUnits="userSpaceOnUse"
        />
      </defs>
      <g id="layer1" transform="translate(562.54175,-175.5984)">
        <path
          style={{
            fill: "#ffa021",
            fillOpacity: 1,
            stroke: "none",
            strokeWidth: "0.401119px",
            strokeLinecap: "butt",
            strokeLinejoin: "miter",
            strokeOpacity: 0.627451,
          }}
          d="m -438.74279,214.89794 h 17.11737 l -8.55869,8.923 z"
          id="path74"
        />
        <rect
          style={{
            opacity: 1,
            fill: "#000000",
            fillOpacity: 0.296343,
            stroke: "none",
            strokeWidth: 2.484,
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "markers stroke fill",
          }}
          id="rect72"
          width={264.71527}
          height={32.200432}
          x={-562.54175}
          y={175.5984}
          ry={10.247559}
        />
        <text
          xmlSpace="preserve"
          style={{
            fontSize: "12.3047px",
            lineHeight: 1.25,
            fontFamily: "sans-serif",
            textAlign: "center",
            textAnchor: "middle",
            fill: "#ffffff",
            strokeWidth: 0.615234,
          }}
          x={-523.04193}
          y={195.26479}
          id="text73"
        >
          <tspan
            id="tspan73"
            x={-523.04193}
            y={195.26479}
            style={{
              fontStyle: "normal",
              fontVariant: "normal",
              fontWeight: "normal",
              fontStretch: "normal",
              fontFamily: "'Open Sans'",
              fill: "#ffffff",
              strokeWidth: 0.615234,
            }}
          >
            {"\n          /bin/\n        "}
          </tspan>
        </text>
        <text
          xmlSpace="preserve"
          style={{
            fontSize: "12.3047px",
            lineHeight: 1.25,
            fontFamily: "sans-serif",
            textAlign: "center",
            textAnchor: "middle",
            fill: "#ffffff",
            strokeWidth: 0.615234,
          }}
          x={-379.88986}
          y={195.26479}
          id="text73-6"
        >
          <tspan
            id="tspan73-2"
            x={-379.88986}
            y={195.26479}
            style={{
              fontStyle: "normal",
              fontVariant: "normal",
              fontWeight: "normal",
              fontStretch: "normal",
              fontFamily: "'Open Sans Mono'",
              fill: "#ffffff",
              strokeWidth: 0.615234,
            }}
          >
            {"\n          #\n        "}
          </tspan>
        </text>
        <text
          xmlSpace="preserve"
          style={{
            fontSize: 10,
            lineHeight: 1.25,
            fontFamily: "monospace",
            textAlign: "center",
            textAnchor: "middle",
            fill: "#333333",
          }}
          x={-445.91898}
          y={194.13223}
          id="text79"
        >
          <tspan
            id="tspan79"
            x={-445.91898}
            y={194.13223}
            style={{
              fontSize: 8,
              fill: "#333333",
            }}
          >
            {CONTENT_VARIANTS[pathIndex].first}
          </tspan>
        </text>
        <text
          xmlSpace="preserve"
          style={{
            fontSize: 10,
            lineHeight: 1.25,
            fontFamily: "monospace",
            textAlign: "center",
            textAnchor: "middle",
            fill: "#333333",
          }}
          x={-338.73135}
          y={193.49733}
          id="text79-9"
        >
          <tspan
            id="tspan79-0"
            x={-338.73135}
            y={193.49733}
            style={{
              fontSize: 8,
              fill: "#333333",
            }}
          >
            {CONTENT_VARIANTS[pathIndex].second}
          </tspan>
        </text>
        <text
          xmlSpace="preserve"
          style={{
            fontSize: "12.3047px",
            lineHeight: 1.25,
            fontFamily: "sans-serif",
            textAlign: "center",
            textAnchor: "middle",
            fill: "#ffffff",
            strokeWidth: 0.615234,
          }}
          x={-444.22906}
          y={195.26479}
          id="text74"
        >
          <tspan
            id="tspan74"
            x={-444.22906}
            y={195.26479}
            style={{
              fontStyle: "normal",
              fontVariant: "normal",
              fontWeight: "bold",
              fontStretch: "normal",
              fontFamily: "'Open Sans'",
              fill: "#ffffff",
              strokeWidth: 0.615234,
            }}
          >
            {"\n          AlbumID\n        "}
          </tspan>
        </text>
        <text
          xmlSpace="preserve"
          style={{
            fontSize: "12.3047px",
            lineHeight: 1.25,
            fontFamily: "sans-serif",
            textAlign: "center",
            textAnchor: "middle",
            fill: "#ffffff",
            strokeWidth: 0.615234,
          }}
          x={-337.45535}
          y={195.26479}
          id="text74-2"
        >
          <tspan
            id="tspan74-8"
            x={-337.45535}
            y={195.26479}
            style={{
              fontStyle: "normal",
              fontVariant: "normal",
              fontWeight: "bold",
              fontStretch: "normal",
              fontFamily: "'Open Sans'",
              fill: "#ffffff",
              strokeWidth: 0.615234,
            }}
          >
            {"\n          Key\n        "}
          </tspan>
        </text>
        <g
          style={{
            fill: "url(#radialGradient75)",
            stroke: "none",
          }}
          transform="matrix(1.9478292,0,0,1.9478292,-453.55806,226.10546)"
        >
          <motion.path d={path} />
        </g>
      </g>
    </svg>
  );
};

export default IntroImg;

const getIndex = (_: string, index: number) => index;

function useFlubber(progress: MotionValue<number>, paths: string[]) {
  return useTransform(progress, paths.map(getIndex), paths, {
    mixer: newInterpolate,
  });
}
const newInterpolate = (a: string, b: string) => {
  const base = a.slice(0, 135);
  const aEnd = a.slice(135);
  const bEnd = b.slice(135);
  const myInterpolate = interpolate(bEnd, aEnd, { maxSegmentLength: 1 });
  return (t: number) => {
    const newEnd = myInterpolate(t);
    return `${base}${newEnd}`;
  };
};

const CONTENT_VARIANTS = [
  {
    first: "a8kd9z3nvpq7c6rft5x2jv",
    second: "r3wz1gt8v6pnf",
    path: "M 18,2 H 6 C 4.9,2 4,2.9 4,4 v 16 c 0,1.1 0.9,2 2,2 h 12 c 1.1,0 2,-0.9 2,-2 V 4 C 20,2.9 19.1,2 18,2 Z M 6,4 h 5 v 8 L 8.5,10.5 6,12 Z M 5 19 L 8 13 L 11 17 L 13 15 L 18 19 Z",
  },
  {
    first: "b4qm1p7twzv6e8yr2kd9nh",
    second: "k9xq4v5jd1m3w",
    path: "M 18,2 H 6 C 4.9,2 4,2.9 4,4 v 16 c 0,1.1 0.9,2 2,2 h 12 c 1.1,0 2,-0.9 2,-2 V 4 C 20,2.9 19.1,2 18,2 Z M 6,4 h 5 v 8 L 8.5,10.5 6,12 Z M 5 19 L 7 15.14 L 9.14 17.72 L 12.14 13.86 L 18 19 Z",
  },
];
const PATHS = CONTENT_VARIANTS.map((e) => e.path);

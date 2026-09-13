import { keyframes, styled } from "../../stitches.config";

/**
 * Upload cloud that fills up like a vessel as the upload progresses.
 *
 * Everything is drawn in the 640×480 space of the original Font Awesome
 * "cloud-upload-alt" glyph: the cloud body spans y 32..480.
 * The fill is revealed through a mask whose top edge is a wave path that
 * slides sideways (CSS transform only), so the surface always looks alive.
 */
type CloudProps = {
  /** 0..100 */
  progress: number;
  /** true while an upload is running — enables the fill, hides the dashed drop hint */
  active: boolean;
  /** the album is end-to-end encrypted: shows the E2E badge */
  encrypted: boolean;
  className?: string;
};

const CLOUD_PATH =
  "m 640,352 c 0,70.692 -57.308,128 -128,128 H 144 C 64.471,480 0,415.529 0,336 0,273.227 40.171,219.845 96.204,200.133 A 163.68,163.68 0 0 1 96,192 C 96,103.634 167.634,32 256,32 315.288,32 367.042,64.248 394.684,112.159 409.935,101.954 428.271,96 448,96 c 53.019,0 96,42.981 96,96 0,12.184 -2.275,23.836 -6.415,34.56 C 596.017,238.414 640,290.07 640,352 Z M 404.686,260.686 299.314,155.314 c -6.248,-6.248 -16.379,-6.248 -22.627,0 L 171.314,260.686 C 161.234,270.766 168.373,288 182.627,288 H 248 v 112 c 0,8.837 7.164,16 16,16 h 48 c 8.836,0 16,-7.163 16,-16 V 288 h 65.373 c 14.254,0 21.393,-17.234 11.313,-27.314 z";

const LOCK_PATH =
  "M 400,224 H 376 V 152 C 376,68.2 307.8,0 224,0 140.2,0 72,68.2 72,152 v 72 H 48 C 21.5,224 0,245.5 0,272 v 192 c 0,26.5 21.5,48 48,48 h 352 c 26.5,0 48,-21.5 48,-48 V 272 c 0,-26.5 -21.5,-48 -48,-48 z m -104,0 H 152 v -72 c 0,-39.7 32.3,-72 72,-72 39.7,0 72,32.3 72,72 z";

// Wave geometry (cloud units). WAVE_LENGTH must divide WAVE_TRAVEL for a seamless loop.
const WAVE_LENGTH = 160;
const WAVE_AMPLITUDE = 9;
const WAVE_TRAVEL = WAVE_LENGTH * 2;
const CLOUD_TOP = 32;
const CLOUD_BOTTOM = 480;

function wavePath(): string {
  const half = WAVE_LENGTH / 2;
  const quarter = WAVE_LENGTH / 4;
  // A quadratic with its control point at -2A peaks at -A; `t` mirrors it for the trough.
  let d = `M0,0 q${quarter},${-2 * WAVE_AMPLITUDE} ${half},0`;
  const halves = (2 * (640 + WAVE_TRAVEL)) / WAVE_LENGTH;
  for (let i = 1; i < halves; i++) d += ` t${half},0`;
  d += ` V ${CLOUD_BOTTOM + 200} H 0 Z`;
  return d;
}

const WAVE_PATH = wavePath();

/** y of the wave's midline: crest touches the cloud bottom at 0 %, trough clears the top at 100 % */
function waterline(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 100) / 100;
  const span = CLOUD_BOTTOM - CLOUD_TOP + 2 * WAVE_AMPLITUDE;
  return CLOUD_BOTTOM + WAVE_AMPLITUDE - span * p;
}

export const Cloud = ({ progress, active, encrypted, className }: CloudProps) => (
  <svg viewBox="0 16 640 480" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="pbCloudFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e9e9e6" />
      </linearGradient>
      <linearGradient id="pbCloudSheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <clipPath id="pbCloudClip">
        <path d={CLOUD_PATH} />
      </clipPath>
      <mask
        id="pbCloudProgress"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="640"
        height="480"
      >
        <Waterline style={{ transform: `translateY(${waterline(progress)}px)` }}>
          <Wave d={WAVE_PATH} fill="#ffffff" />
        </Waterline>
      </mask>
    </defs>

    {/* body */}
    <path d={CLOUD_PATH} fill="currentColor" />

    {/* liquid fill */}
    <g mask="url(#pbCloudProgress)" opacity={active ? 1 : 0}>
      <path d={CLOUD_PATH} fill="url(#pbCloudFill)" />
      <g clipPath="url(#pbCloudClip)">
        <Sheen x={-140} y={-100} width={280} height={700} fill="url(#pbCloudSheen)" />
      </g>
    </g>

    {/* dashed drop hint, idle only */}
    <DropHint
      d={CLOUD_PATH}
      fill="none"
      stroke="#ffffff"
      strokeWidth={6}
      strokeDasharray="18 14"
      strokeLinecap="round"
      style={{ opacity: active ? 0 : 1 }}
    />

    {/* E2E badge: self-contained pill so it reads on both the dark and the filled cloud */}
    {encrypted && (
      <g>
        <rect
          x={352}
          y={388}
          width={226}
          height={70}
          rx={35}
          fill="#181818"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={2}
        />
        <g transform="translate(378 401) scale(0.088)" fill="#EFC15C">
          <path d={LOCK_PATH} />
        </g>
        <text
          x={496}
          y={436}
          textAnchor="middle"
          fill="#EFC15C"
          style={{
            fontFamily: "'Open Sans', system-ui, sans-serif",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          E2E
        </text>
      </g>
    )}
  </svg>
);

const waveSlide = keyframes({
  from: { transform: "translateX(0)" },
  to: { transform: `translateX(${-WAVE_TRAVEL}px)` },
});

const sheenSweep = keyframes({
  "0%": { transform: "translateX(-160px) rotate(18deg)" },
  "100%": { transform: "translateX(940px) rotate(18deg)" },
});

const Waterline = styled("g", {
  transition: "transform 320ms linear",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const Wave = styled("path", {
  animation: `${waveSlide} 2.8s linear infinite`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const Sheen = styled("rect", {
  animation: `${sheenSweep} 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
  "@media (prefers-reduced-motion: reduce)": {
    display: "none",
  },
});

/** Exported so a wrapper can brighten the drop hint on hover. */
export const DropHint = styled("path", {
  transition: "opacity 300ms, stroke-opacity 300ms",
  strokeOpacity: 0.28,
});

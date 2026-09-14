import { ACCENT_COLOR } from "../../theme";

const FEATHER = ACCENT_COLOR;
const BELLY = "#ffc46b";
const DARK_FEATHER = "#c47a12";
const BROW = "#7a4a08";
const BRANCH = "#6a6a6a";
const TEAR = "#d8dde3";
const PUPIL = "#1a1a1a";

/** A round bird with drooping wings and a tear, sitting on a branch that broke. */
export function SadBird(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 200 184"
      aria-hidden="true"
      focusable="false"
    >
      {/* the branch: the perch, its splintered end, and the piece that broke off */}
      <path
        d="M8 150 C 40 144, 70 146, 104 150"
        stroke={BRANCH}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M104 150 l6 -7 M104 150 l5 5"
        stroke={BRANCH}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M116 155 C 130 158, 140 168, 146 182"
        stroke={BRANCH}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M116 155 l-5 -7" stroke={BRANCH} strokeWidth="3" strokeLinecap="round" />
      <ellipse
        cx="140"
        cy="170"
        rx="3"
        ry="6.5"
        fill="#8a8a8a"
        transform="rotate(35 140 170)"
      />
      {/* legs and toes */}
      <path
        d="M84 138 v10 M96 138 v10 M78 148 h12 M90 148 h12"
        stroke={DARK_FEATHER}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* body and belly */}
      <circle cx="90" cy="102" r="40" fill={FEATHER} />
      <ellipse cx="90" cy="118" rx="22" ry="17" fill={BELLY} />
      {/* wings, hanging down to the branch */}
      <path
        d="M60 98 C 44 112, 42 138, 50 156 C 60 148, 66 126, 66 102 Z"
        fill={DARK_FEATHER}
      />
      <path
        d="M120 98 C 136 112, 138 138, 130 156 C 120 148, 114 126, 114 102 Z"
        fill={DARK_FEATHER}
      />
      {/* a tuft that has given up */}
      <path
        d="M82 64 q-6 -9 -14 -3 M90 61 q-1 -11 -8 -13 M98 64 q6 -9 14 -3"
        stroke={DARK_FEATHER}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* eyes, looking down */}
      <circle cx="76" cy="92" r="9" fill="#fff" />
      <circle cx="104" cy="92" r="9" fill="#fff" />
      <circle cx="78" cy="95" r="4.5" fill={PUPIL} />
      <circle cx="102" cy="95" r="4.5" fill={PUPIL} />
      <circle cx="79.5" cy="93.5" r="1.5" fill="#fff" />
      <circle cx="103.5" cy="93.5" r="1.5" fill="#fff" />
      {/* worried brows */}
      <path
        d="M66 86 L 82 79 M114 86 L 98 79"
        stroke={BROW}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* beak */}
      <path d="M84 104 L 96 104 L 90 112 Z" fill={DARK_FEATHER} />
      {/* a tear, and the one before it */}
      <path d="M72 102 C 67 110, 66 116, 72 119 C 78 116, 77 110, 72 102 Z" fill={TEAR} />
      <circle cx="69" cy="130" r="2" fill={TEAR} />
    </svg>
  );
}

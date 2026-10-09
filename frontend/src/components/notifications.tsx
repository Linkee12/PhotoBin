import type { CloseButtonProps } from "react-toastify";
import { pressable, pressableNoScale } from "../pressable";
import { globalCss, styled } from "../stitches.config";
import { ACCENT_COLOR, WARNING_COLOR } from "../theme";

/**
 * Every notification's look: a dark card with a hairline border in its tone,
 * the text in that tone, a pill for its action and a quiet × to dismiss it.
 * Used by the retry bar, the viewer's notice and (restyled below) every toast.
 */
export const NOTICE_TONES = {
  neutral: { text: "#e0e0e0", border: "#3a3a3a" },
  success: { text: "#a5d6a7", border: "#a5d6a766" },
  warning: { text: "#ffcc80", border: "#ffcc8066" },
  error: { text: WARNING_COLOR, border: `${WARNING_COLOR}66` },
} as const;

export const noticeCard = {
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  width: "max-content",
  maxWidth: "calc(100vw - 2rem)",
  minHeight: "2.9rem",
  padding: "0.4rem 0.5rem 0.4rem 1rem",
  borderRadius: "10px",
  backgroundColor: "#1A1A1A",
  border: `solid 1px ${NOTICE_TONES.neutral.border}`,
  color: NOTICE_TONES.neutral.text,
  boxShadow: "0 0.5rem 1.5rem rgba(0, 0, 0, 0.5)",
  fontFamily: "Open Sans",
  fontSize: "0.85rem",
  lineHeight: 1.4,
} as const;

/**
 * How far the bottom notifications sit from the screen's edge: 10px, plus
 * the selection bar (`data-selection-bar`, 50px + 10px) and the retry bar
 * (`data-retry-bar`, under the toasts) while they are shown.
 */
const NOTICE_BOTTOM =
  "calc(10px + env(safe-area-inset-bottom) + var(--notice-above-selection) + var(--notice-above-retry))";
const RETRY_BAR_SLOT = "calc(2.9rem + 10px)";

/** The retry bar's place: above the selection bar, below the toasts. */
export const noticeBottom =
  "calc(10px + env(safe-area-inset-bottom) + var(--notice-above-selection))";

/** A notification's one action ("Retry", "Save"), a pill in the notice's tone. */
export const NoticeAction = styled("button", {
  ...pressable,
  flexShrink: 0,
  height: "2rem",
  padding: "0 0.9rem",
  borderRadius: "1.5rem",
  background: "none",
  fontFamily: "Open Sans",
  fontSize: "0.7rem",
  fontWeight: "bold",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  "&:hover:not(:disabled)": { color: "#fff", borderColor: "#fff" },
  variants: {
    tone: {
      error: { border: `solid 2px ${WARNING_COLOR}`, color: WARNING_COLOR },
      accent: { border: `solid 2px ${ACCENT_COLOR}`, color: ACCENT_COLOR },
    },
  },
  defaultVariants: { tone: "accent" },
});

export const NoticeDismiss = styled("button", {
  ...pressableNoScale,
  flexShrink: 0,
  width: "2rem",
  height: "2rem",
  padding: 0,
  border: "none",
  borderRadius: "50%",
  background: "none",
  color: "#8B8B8B",
  fontSize: "1.2rem",
  lineHeight: 1,
  "&:hover": { color: "#fff", backgroundColor: "rgba(255, 255, 255, 0.08)" },
});

/** The toasts' close button: the same × as every notice. */
export function NoticeCloseButton({ closeToast }: CloseButtonProps) {
  return (
    <NoticeDismiss
      type="button"
      aria-label="Dismiss"
      title="Dismiss"
      onClick={(e) => {
        e.stopPropagation();
        closeToast(e);
      }}
    >
      ×
    </NoticeDismiss>
  );
}

const tone = (name: keyof typeof NOTICE_TONES) => ({
  color: NOTICE_TONES[name].text,
  borderColor: NOTICE_TONES[name].border,
});

/**
 * react-toastify restyled as notices, stacked at the bottom centre above the
 * selection bar and the retry bar. `body` raises the specificity over the
 * library's own stylesheet, including its phone (≤480px) rules.
 */
export const noticeGlobalStyles = globalCss({
  body: {
    "--notice-above-selection": "0px",
    "--notice-above-retry": "0px",
    "--toastify-spinner-color": ACCENT_COLOR,
    "--toastify-spinner-color-empty-area": "#3a3a3a",
  },
  "body:has([data-selection-bar])": { "--notice-above-selection": "60px" },
  "body:has([data-retry-bar])": { "--notice-above-retry": RETRY_BAR_SLOT },
  "body .Toastify__toast-container--bottom-center": {
    width: "max-content",
    maxWidth: "calc(100vw - 2rem)",
    left: "50%",
    bottom: NOTICE_BOTTOM,
    transform: "translateX(-50%)",
    padding: 0,
    alignItems: "center",
  },
  "body .Toastify__toast": {
    ...noticeCard,
    marginBottom: "0.5rem",
    fontFamily: "Open Sans",
  },
  // A running task has no ×: even margins instead of room for one.
  "body .Toastify__toast:not(:has(button))": { paddingRight: "1rem" },
  "body .Toastify__toast-container--bottom-center .Toastify__toast:last-child": {
    marginBottom: 0,
  },
  "body .Toastify__toast--success": tone("success"),
  "body .Toastify__toast--warning": tone("warning"),
  "body .Toastify__toast--error": tone("error"),
  // The tone says it; only a running task keeps its spinner.
  "body .Toastify__toast-icon:not(:has(.Toastify__spinner))": { display: "none" },
  "body .Toastify__toast-icon": { width: "18px", marginInlineEnd: "-0.25rem" },
  "body .Toastify__spinner": { width: "16px", height: "16px" },
});

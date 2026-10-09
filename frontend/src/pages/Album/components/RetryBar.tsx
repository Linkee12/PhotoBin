import {
  NOTICE_TONES,
  NoticeAction,
  NoticeDismiss,
  noticeBottom,
  noticeCard,
} from "../../../components/notifications";
import { styled } from "../../../stitches.config";

/**
 * Files of the last upload that did not make it: a notice fixed at the bottom
 * of the screen (above the selection bar while that is shown, under any
 * toasts), wherever the page is scrolled, until they are retried or dismissed.
 */
export function RetryBar(props: {
  count: number;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Bar role="status" data-retry-bar>
      <span>
        {props.count} {props.count === 1 ? "photo" : "photos"} didn&apos;t upload
      </span>
      <NoticeAction type="button" tone="error" onClick={props.onRetry}>
        Retry
      </NoticeAction>
      <NoticeDismiss
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={props.onDismiss}
      >
        ×
      </NoticeDismiss>
    </Bar>
  );
}

const Bar = styled("div", {
  ...noticeCard,
  color: NOTICE_TONES.error.text,
  borderColor: NOTICE_TONES.error.border,
  position: "fixed",
  left: "50%",
  bottom: noticeBottom,
  transform: "translateX(-50%)",
  // Above the album, below the viewer (9) and the dialogs.
  zIndex: 3,
  "& > span": { whiteSpace: "nowrap" },
});

import { MouseEvent, PointerEvent, useCallback, useRef } from "react";

/**
 * Lets a gesture (a pinch, a long press) swallow the click the browser
 * synthesises when its fingers lift, so the tile under them is not opened or
 * toggled. Call `arm()` from the gesture; spread `handlers` on the container.
 *
 * The flag is cleared on the next primary pointerdown of any kind, before the
 * gestures see it: by then the click, if the browser produced one at all, has
 * been and gone (Android fires `contextmenu` instead after a long press), so
 * a later mouse click on a hybrid device is never eaten.
 */
export function useSwallowNextClick() {
  const armed = useRef(false);
  const arm = useCallback(() => {
    armed.current = true;
  }, []);
  const onPointerDownCapture = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.isPrimary) armed.current = false;
  }, []);
  const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!armed.current) return;
    armed.current = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);
  return { arm, handlers: { onPointerDownCapture, onClickCapture } };
}

import { readItem, writeItem } from "../../../utils/storage";
import { ALBUM_VIEWS, AlbumView, DEFAULT_ALBUM_VIEW } from "./groupFiles";

const VIEW_STORAGE_KEY = "photobin:albumView";

/** The grid view this browser last chose (`history` by default). */
export function readStoredView(): AlbumView {
  const stored = readItem(VIEW_STORAGE_KEY);
  return ALBUM_VIEWS.find((view) => view === stored) ?? DEFAULT_ALBUM_VIEW;
}

export function storeView(view: AlbumView) {
  writeItem(VIEW_STORAGE_KEY, view);
}

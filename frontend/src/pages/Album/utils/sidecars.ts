import type { Sidecar } from "./groupFiles";

/** `photo.JPG` → `JPG`; `FILE` without an extension. */
export function extensionLabel(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : "FILE";
}

/** `CR3`, or `CR3 +1` when more files are attached. */
export function sidecarLabel(sidecars: Sidecar[]): string {
  const ext = extensionLabel(sidecars[0].name);
  return sidecars.length > 1 ? `${ext} +${sidecars.length - 1}` : ext;
}

/** Tooltip of a sidecar toggle: the action and every attached file's name. */
export function sidecarTitle(sidecars: Sidecar[], selected: boolean): string {
  const names = sidecars.map((s) => s.name).join("\n");
  return `${selected ? "Deselect" : "Select"} ${names}`;
}

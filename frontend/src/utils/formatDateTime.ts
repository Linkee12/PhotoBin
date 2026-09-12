import { formatDate } from "./formatDate";

/** `MM/DD HH:mm` in local time, matching the `MM/DD` used for photo dates. */
export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(timestamp)} ${hh}:${mm}`;
}

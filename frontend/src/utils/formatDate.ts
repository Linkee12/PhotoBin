export function formatDate(rawDate: number): string {
  const raw = new Date(rawDate);
  return `${raw.getFullYear()}/${String(raw.getMonth() + 1).padStart(2, "0")}/${String(raw.getDate()).padStart(2, "0")}`;
}

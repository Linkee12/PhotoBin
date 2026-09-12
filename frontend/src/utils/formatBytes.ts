const UNITS = ["B", "KB", "MB", "GB"] as const;

function unitIndex(bytes: number): number {
  let i = 0;
  while (bytes >= 1024 && i < UNITS.length - 1) {
    bytes /= 1024;
    i++;
  }
  return i;
}

function toUnit(bytes: number, unit: number): string {
  const value = bytes / 1024 ** unit;
  return value.toFixed(unit === 0 ? 0 : 1);
}

/** "30.7 of 48.1 MB" — both numbers share the unit of the total so they are easy to compare. */
export function formatBytesPair(uploaded: number, total: number): string {
  const unit = unitIndex(total);
  return `${toUnit(Math.min(uploaded, total), unit)} of ${toUnit(total, unit)} ${UNITS[unit]}`;
}

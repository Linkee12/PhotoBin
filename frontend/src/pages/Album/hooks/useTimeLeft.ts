import { useEffect, useState } from "react";
import { formatTimeLeft } from "../../../utils/formatTimeLeft";

/** "N days left" for `expiresAt`, refreshed every minute; empty when unknown. */
export function useTimeLeft(expiresAt: number | null) {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(expiresAt));
  useEffect(() => {
    setTimeLeft(formatTimeLeft(expiresAt));
    if (expiresAt === null) return;
    const id = setInterval(() => setTimeLeft(formatTimeLeft(expiresAt)), 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return timeLeft;
}

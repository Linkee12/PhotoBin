import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { rotateService } from "../services";
import { AlbumFile, Rotation } from "../services/renditions";

/** Clicks within this window are coalesced into a single rotation request. */
const ROTATE_DEBOUNCE_MS = 700;

type Size = { width: number; height: number };

/**
 * Scale needed for an image that is shown with `object-fit: contain` in a
 * `viewport`-sized box to still fit after a quarter turn.
 */
export function rotatedFitScale(natural: Size, viewport: Size, quarterTurns: number) {
  if (quarterTurns % 2 === 0) return 1;
  if (!natural.width || !natural.height) return 1;
  const fit = Math.min(viewport.width / natural.width, viewport.height / natural.height);
  const shownWidth = natural.width * fit;
  const shownHeight = natural.height * fit;
  return Math.min(1, viewport.width / shownHeight, viewport.height / shownWidth);
}

type Options = {
  fileId: string;
  file: AlbumFile | undefined;
  albumId: string | undefined;
  key: string | null;
  /** A rotation was saved: refresh the metadata to pick up the re-rendered parts. */
  onSaved: () => void;
  onNotice: (text: string) => void;
  /** Every click, before the picture turns: a turn makes any zoom/pan meaningless. */
  onTurn: () => void;
};

/**
 * Optimistic rotation of the viewer's picture. Each click turns it with CSS at
 * once; the server is asked once, after the clicks settle, to re-render at the
 * final absolute rotation. At most one request is in flight; clicks made
 * meanwhile go out as one more request. On conflict or failure the picture
 * turns back to what the server has.
 */
export function useOptimisticRotation(options: Options) {
  const { fileId, file } = options;
  /** Quarter turns applied with CSS on top of the picture currently shown. */
  const [cssTurns, setCssTurns] = useState(0);
  /** Animate the CSS turn (clicks) or apply it instantly (image swap). */
  const [animateTurn, setAnimateTurn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** Absolute rotation the user wants for the shown file (server + unsent clicks). */
  const targetRef = useRef<Rotation>(0);
  /** Rotation not yet sent; at most one job, always for the latest target. */
  const pendingJobRef = useRef<{ file: AlbumFile; target: Rotation } | null>(null);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Rotations confirmed by the server since the last metadata refresh. */
  const serverRotationsRef = useRef(new Map<string, Rotation>());
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const flushRef = useRef<() => void>(() => undefined);

  function serverRotation(target: AlbumFile): Rotation {
    return serverRotationsRef.current.get(target.fileId) ?? target.rotation ?? 0;
  }

  // A new file starts from its server rotation; the previous file's unsent
  // clicks were flushed by the caller before stepping.
  useLayoutEffect(() => {
    targetRef.current = file === undefined ? 0 : serverRotation(file);
  }, [fileId]);

  function scheduleFlush() {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flushRef.current(), ROTATE_DEBOUNCE_MS);
  }

  function rotate() {
    if (file === undefined) return;
    const target = ((targetRef.current + 1) % 4) as Rotation;
    targetRef.current = target;
    pendingJobRef.current = { file, target };
    optionsRef.current.onTurn();
    setAnimateTurn(true);
    setCssTurns((turns) => turns + 1);
    scheduleFlush();
  }

  /** Reverts the optimistic turns of `job` back to what the server has. */
  function revert(job: { file: AlbumFile }, server: Rotation) {
    if (job.file.fileId !== optionsRef.current.fileId) return;
    if (pendingJobRef.current?.file.fileId === job.file.fileId)
      pendingJobRef.current = null;
    const delta = (targetRef.current - server + 4) % 4;
    targetRef.current = server;
    setAnimateTurn(true);
    setCssTurns((turns) => turns - delta);
  }

  /** Sends the pending rotation now (one request at a time). */
  function flush() {
    clearTimeout(debounceRef.current);
    const job = pendingJobRef.current;
    const { albumId, key } = optionsRef.current;
    if (!job || inFlightRef.current || albumId === undefined) return;
    pendingJobRef.current = null;
    const server = serverRotation(job.file);
    if (job.target === server) return;
    inFlightRef.current = true;
    setIsSaving(true);
    rotateService
      .rotateTo(albumId, job.file, key, job.target)
      .then((res) => {
        if (res.result === "edit-in-progress") {
          revert(job, server);
          optionsRef.current.onNotice("Someone is editing this photo, try again shortly");
        } else {
          serverRotationsRef.current.set(job.file.fileId, job.target);
          optionsRef.current.onSaved();
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        revert(job, server);
        optionsRef.current.onNotice("Rotation failed, please try again");
      })
      .finally(() => {
        inFlightRef.current = false;
        setIsSaving(false);
        // Clicks made while the request was in flight: send them as one more request.
        if (pendingJobRef.current) scheduleFlush();
      });
  }
  flushRef.current = flush;

  // A pending rotation must not be lost when the viewer goes away.
  useEffect(() => () => flushRef.current(), []);

  /** A picture with `baked` turns in its pixels was swapped in: only the rest stays on CSS. */
  function onImageSwapped(baked: Rotation) {
    setCssTurns((targetRef.current - baked + 4) % 4);
    setAnimateTurn(false);
  }

  return { cssTurns, animateTurn, isSaving, rotate, flush, onImageSwapped };
}

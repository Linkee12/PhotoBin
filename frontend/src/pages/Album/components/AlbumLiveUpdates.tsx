import { Boundary, useStream } from "@cuple/react";
import { useEffect, useMemo, useRef } from "react";
import { client } from "../../../cuple";
import { createCoalescer, isStale, reconnectDelay } from "../utils/liveUpdates";

/** A burst of changes (someone uploading) becomes one refresh per quiet gap… */
const CHANGE_QUIET_MS = 400;
/** …but at least one every couple of seconds while it lasts. */
const CHANGE_MAX_WAIT_MS = 2000;
const WATCHDOG_INTERVAL_MS = 10_000;

type LiveUpdatesProps = {
  albumId: string;
  /** Someone (this tab included) changed the album, or events may have been missed. */
  onChanged: () => void;
  /** Someone deleted the album. */
  onDeleted: () => void;
};

/**
 * Keeps the open album in step with everyone else who has the link, through
 * the server's `albumEvents` stream. Renders nothing. The stream carries no
 * album data, only "changed": the page re-fetches the encrypted metadata.
 *
 * A refused connection (the album is gone) must not take the page down: it
 * asks for one refresh, which finds out what happened, and stops following.
 */
export function AlbumLiveUpdates(props: LiveUpdatesProps) {
  return (
    <Boundary error={() => <StreamRefused onRefused={props.onChanged} />}>
      <Feed {...props} />
    </Boundary>
  );
}

function StreamRefused(props: { onRefused: () => void }) {
  const onRefused = useRef(props.onRefused);
  useEffect(() => onRefused.current(), []);
  return null;
}

function Feed(props: LiveUpdatesProps) {
  const latest = useRef(props);
  latest.current = props;
  const lastHeardAt = useRef(Date.now());
  const connections = useRef(0);
  const failures = useRef(0);
  const changes = useMemo(
    () =>
      createCoalescer(CHANGE_QUIET_MS, CHANGE_MAX_WAIT_MS, () =>
        latest.current.onChanged(),
      ),
    [],
  );
  useEffect(() => () => changes.cancel(), [changes]);

  const feed = useStream(
    client.albumEvents.get,
    { query: { albumId: props.albumId } },
    (event) => {
      lastHeardAt.current = Date.now();
      switch (event.type) {
        case "connected":
          failures.current = 0;
          // Back after a drop: whatever happened meanwhile was not sent to us.
          if (connections.current++ > 0) latest.current.onChanged();
          break;
        case "changed":
          changes.schedule();
          break;
        case "deleted":
          changes.cancel();
          latest.current.onDeleted();
          break;
        case "ping":
          break;
      }
    },
  );

  // A dropped or ended stream reconnects on its own, backing off.
  const { reconnect } = feed;
  useEffect(() => {
    if (feed.isStreaming) return;
    const id = setTimeout(() => {
      lastHeardAt.current = Date.now();
      reconnect();
    }, reconnectDelay(failures.current++));
    return () => clearTimeout(id);
  }, [feed.isStreaming, feed.error, reconnect]);

  // A phone that slept, or a connection a proxy silently dropped, looks
  // open but hears nothing: the server pings every 25 s, so silence means dead.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (!isStale(lastHeardAt.current, Date.now())) return;
      lastHeardAt.current = Date.now();
      reconnect();
    };
    const id = setInterval(check, WATCHDOG_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [reconnect]);

  return null;
}

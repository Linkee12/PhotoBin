import { styled, TOOLBAR_INLINE_QUERY } from "../../../stitches.config";
import { Cloud, DropHint } from "@assets/images/cloud";
import { DragNdrop } from "./DragNdrop";
import { AlbumSection } from "./AlbumSection";
import { PULSE_MS } from "./AlbumItem";
import { useEffect, useRef, useState } from "react";
import { useAlbumContext } from "../hooks/useAlbumContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { UploadService } from "../services/UploadService";
import { ThumbnailGroup } from "../Album";
import { Panel, PushDown } from "./Panel";
import { Menu } from "./Menu";
import { toast } from "react-toastify";
import { formatTimeLeft } from "../../../utils/formatTimeLeft";
import { acquireWakeLock } from "../../../utils/wakeLock";
import { isAbortError } from "../../../utils/retry";
import { formatBytesPair } from "../../../utils/formatBytes";
import { randomBatchName } from "../../../utils/batchName";
import { AlbumView } from "../../../utils/groupFiles";
import { UploadBatch } from "../services/PendingUploadStore";

type UploadProgress = { percent: number; uploadedBytes: number; totalBytes: number };

/**
 * idle      → nothing running
 * uploading → batch in flight; the indicator never shows 100 % here
 * done      → batch succeeded: fill snaps to 100 % on the still-dimmed album
 * outro     → indicator and mask fade out while the new tiles pulse
 */
type UploadPhase = "idle" | "uploading" | "done" | "outro";
const DONE_MS = 500;
const OUTRO_MS = 300;

type AlbumContentProps = {
  showUploader: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  isLoadingThumbnails: boolean;
  downloadProgress: number;
  thumbnailGroups: ThumbnailGroup[];
  view: AlbumView;
  onChangeView: (view: AlbumView) => void;
  onRenameBatch: (batchId: string, name: string) => void;
  uploadService: UploadService;

  // selection
  selectedImages: string[];
  isSelected: (imageId: string) => boolean;
  onSelect: (imagesId: string[]) => void;
  onDeSelect: (imagesId: string[]) => void;
  onOpen: (imageId: string) => void;
  onDownloadAll: (files: string[]) => void;
  onUploadStarted: () => void;
  onUploadFinished: () => void;
  /** A file finished uploading; its thumbnail is known before metadata lists it. */
  onUploaded: (uploaded: {
    fileId: string;
    thumbnail: string | undefined;
    thumbnailIv: string | undefined;
  }) => void;
};

export function AlbumContent(props: AlbumContentProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [newFileIds, setNewFileIds] = useState<string[]>([]);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  // Where the toolbar is the wide shelf, the first group's header shares its
  // row (rendered into this slot); otherwise it heads its own band.
  const toolbarInline = useMediaQuery(TOOLBAR_INLINE_QUERY);
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const { metadata, refreshMetadata, key, expiresAt } = useAlbumContext();
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(expiresAt));

  useEffect(() => {
    setTimeLeft(formatTimeLeft(expiresAt));
    if (expiresAt === null) return;
    const id = setInterval(() => setTimeLeft(formatTimeLeft(expiresAt)), 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  function setProgress(percent: number, uploadedBytes: number, totalBytes: number) {
    setUploadProgress({ percent, uploadedBytes, totalBytes });
  }

  async function uploadImages(files: File[]) {
    if (!metadata) {
      toast.error("Album is still loading, please try again");
      return;
    }
    if (props.isUploading || phase !== "idle" || files.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const releaseWakeLock = acquireWakeLock();
    window.addEventListener("beforeunload", warnBeforeUnload);
    props.onUploadStarted();
    setPhase("uploading");
    setFailedFiles([]);
    const failed: File[] = [];
    const uploaded: string[] = [];
    let cancelled = false;
    let completed = false;
    try {
      // Every picked set of files is its own batch with a fresh fantasy name;
      // resumed or retried files keep the batch they were first picked with.
      const batch = await props.uploadService.createBatch(randomBatchName(), key);
      const results = upload({
        uploadService: props.uploadService,
        files,
        key,
        metadata,
        batch,
        signal: controller.signal,
      });

      for await (const result of results) {
        if (result.result === "progress") {
          setProgress(result.progress, result.uploadedBytes, result.totalBytes);
        } else if (result.result === "failed") {
          failed.push(result.file);
        } else if (result.result === "cancelled") {
          cancelled = true;
          failed.push(...result.remaining);
        } else {
          uploaded.push(result.fileId);
          props.onUploaded(result);
          // The tile shows as soon as metadata lists the file.
          refreshMetadata();
        }
      }
      completed = true;
      if (cancelled) {
        toast.info("Upload cancelled");
      } else if (failed.length > 0) {
        toast.error(`${failed.length} of ${files.length} files failed`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
    } finally {
      abortRef.current = null;
      window.removeEventListener("beforeunload", warnBeforeUnload);
      releaseWakeLock();
      setFailedFiles(failed);
      refreshMetadata();
      if (completed && !cancelled && uploaded.length > 0) {
        await playOutro(uploaded);
      }
      setPhase("idle");
      setUploadProgress(null);
      props.onUploadFinished();
    }
  }
  /**
   * 100 % flash on the dimmed album → indicator and mask fade out while the
   * new tiles scroll into view and pulse. Unlocks ~1.3 s after the batch ends.
   */
  async function playOutro(fileIds: string[]) {
    setPhase("done");
    await wait(DONE_MS);
    setPhase("outro");
    setNewFileIds(fileIds);
    await wait(PULSE_MS);
    setNewFileIds([]);
  }
  // A group that receives freshly uploaded tiles opens so the pulse is visible.
  useEffect(() => {
    if (newFileIds.length === 0) return;
    const receiving = props.thumbnailGroups
      .filter((group) => group.thumbnails.some((thumb) => newFileIds.includes(thumb.id)))
      .map((group) => group.key);
    if (!receiving.some((key) => collapsedGroups.has(key))) return;
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      for (const key of receiving) next.delete(key);
      return next;
    });
  }, [newFileIds, props.thumbnailGroups]);
  function renameHandler(batchId: string | undefined) {
    if (batchId === undefined) return undefined;
    return (name: string) => props.onRenameBatch(batchId, name);
  }
  function toggleCollapsed(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }
  function cancelUpload() {
    abortRef.current?.abort();
  }
  function retryFailedUploads() {
    uploadImages(failedFiles).catch((e) => console.error(e));
  }
  function openFilePicker() {
    if (!ref.current) return;
    ref.current.click();
  }
  const shownPercent = displayedPercent(phase, uploadProgress?.percent ?? 0);
  const hasFailedFiles = failedFiles.length > 0;
  let cloudText = "Drop photos here";
  if (props.isUploading) cloudText = "Preparing your photos";
  else if (hasFailedFiles)
    cloudText = `${failedFiles.length} of your files didn't upload`;
  function getAllId(): string[] {
    return props.thumbnailGroups.flatMap((group) =>
      group.thumbnails.map((file) => file.id),
    );
  }
  return (
    <Panel variant={0} zIndex={1}>
      {timeLeft && (
        <RemainingTimeContainer>
          <PushDown />
          <RemainingTime>{timeLeft}</RemainingTime>
        </RemainingTimeContainer>
      )}
      <DragNdrop
        onDroppedFiles={(files) => {
          if (files != null) {
            const fileArr = Array.from(files);
            uploadImages(fileArr).catch((e) => console.error(e));
          }
        }}
      >
        {/* Drop hero / upload indicator / retry notice, before the toolbar so the
            first group's band still overlaps the toolbar shelf, not this. */}
        <CloudSlot>
          <CloudContainer
            placement={props.showUploader ? "floating" : "inline"}
            isVisible={props.showUploader || hasFailedFiles}
            isFadingOut={phase === "outro"}
            onClick={openFilePicker}
          >
            <StyledUpload progress={shownPercent} active={phase !== "idle"} />
            {uploadProgress ? (
              <UploadStats>
                <Percent>{shownPercent}%</Percent>
                <Bytes>
                  {formatBytesPair(
                    uploadProgress.uploadedBytes,
                    uploadProgress.totalBytes,
                  )}
                </Bytes>
              </UploadStats>
            ) : (
              <Text>
                {cloudText}
                {!props.isUploading && !hasFailedFiles && (
                  <TextHint>or click to browse</TextHint>
                )}
              </Text>
            )}
            {phase === "uploading" && (
              <UploadAction
                onClick={(e) => {
                  e.stopPropagation();
                  cancelUpload();
                }}
              >
                Cancel upload
              </UploadAction>
            )}
            {phase === "idle" && hasFailedFiles && (
              <UploadAction
                onClick={(e) => {
                  e.stopPropagation();
                  retryFailedUploads();
                }}
              >
                Retry failed uploads ({failedFiles.length})
              </UploadAction>
            )}
          </CloudContainer>
        </CloudSlot>
        {props.thumbnailGroups.length > 0 && (
          <Menu
            headerSlotRef={setHeaderSlot}
            onDownloadAll={() => props.onDownloadAll(getAllId())}
            onAddPhoto={openFilePicker}
            isBusy={props.isUploading || props.isDownloading}
            view={props.view}
            onChangeView={props.onChangeView}
          />
        )}
        <AlbumSections>
          {props.thumbnailGroups.map((group, i) => (
            <AlbumSection
              key={group.key}
              group={group}
              index={i}
              isCollapsed={collapsedGroups.has(group.key)}
              onToggleCollapsed={() => toggleCollapsed(group.key)}
              onRename={renameHandler(group.batchId)}
              headerSlot={i === 0 && toolbarInline ? headerSlot : null}
              newFileIds={newFileIds}
              selectedImages={props.selectedImages}
              isSelected={props.isSelected}
              onSelect={props.onSelect}
              onDeSelect={props.onDeSelect}
              onOpen={props.onOpen}
            />
          ))}
          {props.isLoadingThumbnails && (
            <LoadingThumbnails>
              <Spinner />
            </LoadingThumbnails>
          )}
        </AlbumSections>
        <UploadMask show={phase === "uploading" || phase === "done"} />
        <DownloadMask show={props.isDownloading}>
          <DownloadText>Preparing your files</DownloadText>
          {props.downloadProgress > 0 && (
            <DownloadPercent>{props.downloadProgress}%</DownloadPercent>
          )}
        </DownloadMask>
        <UploadSection isEmpty={props.thumbnailGroups.length > 0}>
          <input
            type="file"
            style={{ display: "none" }}
            ref={ref}
            multiple
            onChange={(e) => {
              if (e.target.files != null) {
                const array = Array.from(e.target.files);
                // Reset so picking the same file again (to resume it) fires onChange.
                e.target.value = "";
                uploadImages(array).catch((e) => console.error(e));
              }
            }}
          ></input>
        </UploadSection>
      </DragNdrop>
    </Panel>
  );
}

/**
 * Never shows 100 % while the batch is still running: the last steps
 * (finalize, metadata refresh) happen after the bytes are sent.
 */
function displayedPercent(phase: UploadPhase, percent: number): number {
  if (phase === "idle") return 0;
  if (phase === "uploading") return Math.min(Math.floor(percent), 99);
  return 100;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function warnBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  // Legacy browsers (e.g. Chrome < 119) only show the prompt when returnValue is set.
  e.returnValue = true;
}

type BatchYield =
  | { result: "progress"; progress: number; uploadedBytes: number; totalBytes: number }
  | { result: "failed"; file: File }
  | { result: "cancelled"; remaining: File[] }
  | {
      result: "finish";
      fileId: string;
      thumbnail: string | undefined;
      thumbnailIv: string | undefined;
    };

/**
 * Uploads files one after another. A file that fails after retries is reported
 * and the batch continues; an abort stops the batch and reports what is left.
 */
async function* upload(params: {
  uploadService: UploadService;
  files: File[];
  key: string | null;
  metadata: { albumId: string };
  batch: UploadBatch;
  signal: AbortSignal;
}): AsyncGenerator<BatchYield> {
  const arrLength = params.files.length;
  const totalSize = params.files.reduce((acc, file) => file.size + acc, 0);
  let currentSize = 0;
  for (let i = 0; i < arrLength; ++i) {
    const file = params.files[i];
    try {
      const uploadData = params.uploadService.upload(file, {
        albumId: params.metadata.albumId,
        key: params.key,
        batch: params.batch,
        signal: params.signal,
      });
      for await (const response of uploadData) {
        if (response.result === "progress") {
          currentSize += response.bytes;
          yield {
            result: "progress",
            progress: Math.min(100, (currentSize / totalSize) * 100),
            uploadedBytes: currentSize,
            totalBytes: totalSize,
          };
        } else {
          yield {
            result: "finish",
            fileId: response.fileId,
            thumbnail: response.thumbnail,
            thumbnailIv: response.thumbnailIv,
          };
        }
      }
    } catch (e) {
      if (isAbortError(e)) {
        yield { result: "cancelled", remaining: params.files.slice(i) };
        return;
      }
      console.error(`Upload of ${file.name} failed`, e);
      yield { result: "failed", file };
    }
  }
}

/**
 * Cancel / retry, part of the cloud block right under the stats so it can
 * never collide with the indicator. Same pill as the toolbar buttons.
 */
const UploadAction = styled("button", {
  marginTop: "1rem",
  display: "flex",
  alignItems: "center",
  background: "#0e0e0e",
  color: "#fff",
  border: "solid 2px #333333",
  borderRadius: "1.5rem",
  height: "2.5rem",
  padding: "0.5rem 1.2rem",
  fontFamily: "Open Sans",
  fontSize: "0.7rem",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  cursor: "pointer",
  "&:hover": {
    borderColor: "#8B8B8B",
  },
  "&:focus-visible": {
    outline: "2px solid #DBDCD9",
    outlineOffset: "2px",
  },
});

const UploadSection = styled("div", {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  variants: {
    isEmpty: {
      true: {
        background: "#333333",
      },
      false: {
        background: "#181818",
      },
    },
  },
});

const AlbumSections = styled("div", {
  display: "flex",
  flexDirection: "column",
});

const LoadingThumbnails = styled("div", {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "4rem",
});

const Spinner = styled("div", {
  width: "3rem",
  height: "3rem",
  border: "5px solid rgba(255, 255, 255, 0.2)",
  borderTop: "5px solid #DBDCD9",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
});

/** Centres the cloud block; the floating variant takes its horizontal position from here. */
const CloudSlot = styled("div", {
  display: "flex",
  justifyContent: "center",
  width: "100%",
});

const CloudContainer = styled("div", {
  flexDirection: "column",
  alignItems: "center",
  transition: `opacity ${OUTRO_MS}ms ease-out`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
  variants: {
    placement: {
      // Hero of an empty album, and the progress indicator over the dimmed album.
      floating: {
        position: "absolute",
        top: "18rem",
        // Above the upload mask, which comes later in the DOM.
        zIndex: 2,
      },
      // After failures in a filled album: in flow above the toolbar, about
      // where the floating indicator was.
      inline: {
        position: "static",
        padding: "3rem 1rem 1.5rem",
      },
    },
    isVisible: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
    isFadingOut: {
      true: {
        opacity: 0,
        pointerEvents: "none",
      },
      false: {
        opacity: 1,
      },
    },
  },
});

const Text = styled("div", {
  textAlign: "center",
  width: "14rem",
  fontFamily: "Open Sans",
  fontSize: "1rem",
  marginTop: "0.75rem",
  color: "#DBDCD9",
});

const TextHint = styled("div", {
  fontSize: "0.8rem",
  color: "#8B8B8B",
  marginTop: "0.15rem",
});

const UploadStats = styled("div", {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: "0.75rem",
  fontFamily: "Open Sans",
  fontVariantNumeric: "tabular-nums",
});

const Percent = styled("div", {
  fontSize: "1.6rem",
  fontWeight: 600,
  lineHeight: 1.1,
  color: "#F2F2F0",
});

const Bytes = styled("div", {
  fontSize: "0.8rem",
  color: "#8B8B8B",
  marginTop: "0.25rem",
  whiteSpace: "nowrap",
});

const StyledUpload = styled(Cloud, {
  width: "12rem",
  height: "12rem",
  color: "#333333",
  cursor: "pointer",
  transition: "color 300ms",
  [`&:hover ${DropHint}`]: {
    strokeOpacity: 0.55,
  },
  "&:hover": {
    color: "#3d3d3d",
  },
});

const UploadMask = styled("div", {
  position: "fixed",
  top: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0,0.5)",
  transition: `opacity ${OUTRO_MS}ms ease-out`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
  variants: {
    show: {
      true: {
        opacity: 1,
      },
      false: {
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
});
const DownloadMask = styled("div", {
  position: "fixed",
  top: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "2rem",
  fontWeight: "bold",
  fontFamily: "Open Sans",
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0,0.5)",
  variants: {
    show: {
      true: {
        display: "flex",
      },
      false: {
        display: "none",
      },
    },
  },
});
const DownloadText = styled("div", {});
const DownloadPercent = styled("div", {
  fontSize: "1.5rem",
  color: "#DBDCD9",
});
const RemainingTimeContainer = styled("div", {
  display: "flex",
  flexDirection: "row",
});
const RemainingTime = styled("div", {
  display: "flex",
  alignItems: "center",
  paddingRight: "2rem",
  color: "#8B8B8B",
  fontSize: "0.8rem",
  fontWeight: "bold",
  whiteSpace: "nowrap",
});

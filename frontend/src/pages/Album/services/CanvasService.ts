import { coverSize, fitWithin } from "../utils/imageSize";

export type ResizeOptions = {
  quality?: number;
  /** Exact output size; the image is cropped to fill it. */
  targetSize?: { width: number; height: number };
  /**
   * The smallest size that covers this box with the whole frame (no crop),
   * see `coverSize`. Ignored when `targetSize` is set.
   */
  cover?: { width: number; height: number };
  /** Cap the longer edge, keeping the aspect ratio. Ignored when `targetSize` is set. */
  maxEdge?: number;
  mimeType?: "image/webp" | "image/jpeg";
};

type ImageSource = HTMLImageElement | HTMLCanvasElement;

const VIDEO_FRAME_TIMEOUT_MS = 15_000;

export class CanvasService {
  /**
   * Decodes `file` once so several renditions can be drawn from it. A canvas
   * (e.g. from `rotate`) can be wrapped the same way without re-decoding.
   */
  async load(file: Blob | HTMLCanvasElement): Promise<LoadedImage> {
    const source = file instanceof HTMLCanvasElement ? file : await this._loadImage(file);
    return new LoadedImage(source, this);
  }

  /** Draws `file` rotated by `quarterTurns` * 90° clockwise onto a new full-resolution canvas. */
  async rotate(file: Blob, quarterTurns: number): Promise<HTMLCanvasElement> {
    const imageObj = await this._loadImage(file);
    const turns = ((quarterTurns % 4) + 4) % 4;
    const swap = turns % 2 === 1;
    const { canvas, ctx } = this._initCanvas({
      width: swap ? imageObj.height : imageObj.width,
      height: swap ? imageObj.width : imageObj.height,
    });
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(imageObj, -imageObj.width / 2, -imageObj.height / 2);
    URL.revokeObjectURL(imageObj.src);
    return canvas;
  }

  encode(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return canvasToBlob(canvas, mimeType, quality);
  }

  /**
   * A JPEG of the frame at 1 s (or the middle of shorter clips). Rejects when
   * the browser cannot decode the video (e.g. HEVC outside Safari) or takes
   * longer than `VIDEO_FRAME_TIMEOUT_MS`, so the caller can fall back.
   */
  async getImageFromVideo(file: File): Promise<Blob> {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    // iOS only decodes frames of muted, inline videos without a user gesture.
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<Blob>((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Video frame timed out")),
          VIDEO_FRAME_TIMEOUT_MS,
        );
        video.onerror = () => reject(new Error("Video loading error"));
        video.onloadedmetadata = () => {
          video.currentTime = Number.isFinite(video.duration)
            ? Math.min(1, video.duration / 2)
            : 0;
        };
        video.onseeked = () => {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            reject(new Error("Video has no decodable frames"));
            return;
          }
          const { canvas, ctx } = this._initCanvas({
            width: video.videoWidth,
            height: video.videoHeight,
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvasToBlob(canvas, "image/jpeg", 1).then(resolve, reject);
        };
        video.load();
      });
    } finally {
      clearTimeout(timeout);
      video.onerror = video.onloadedmetadata = video.onseeked = null;
      // Detach the source so the browser drops its decoder right away.
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }

  drawToCanvas(imageObj: ImageSource, target: { width: number; height: number }) {
    const { canvas, ctx } = this._initCanvas(target);
    const transform = this._getTransform(sourceSize(imageObj), canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObj, transform.x, transform.y, transform.width, transform.height);
    return canvas;
  }
  private _initCanvas(target: { width: number; height: number }) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context is null");
    canvas.width = target.width;
    canvas.height = target.height;
    return { canvas, ctx };
  }

  private _getTransform(
    origin: { width: number; height: number },
    target: { width: number; height: number },
  ) {
    const originAspectRatio = origin.width / origin.height;
    const targetAspectRatio = target.width / target.height;
    if (originAspectRatio > targetAspectRatio) {
      const drawWidth = origin.width * (target.height / origin.height);
      return {
        x: (target.width - drawWidth) / 2,
        y: 0,
        width: drawWidth,
        height: target.height,
      };
    }
    const drawHeight = origin.height * (target.width / origin.width);
    return {
      width: target.width,
      height: origin.height * (target.width / origin.width),
      x: 0,
      y: (target.height - drawHeight) / 2,
    };
  }
  private _loadImage(file: Blob): Promise<HTMLImageElement> {
    const imageObj = new Image();
    imageObj.src = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      imageObj.onload = () => resolve(imageObj);
      imageObj.onerror = () => {
        URL.revokeObjectURL(imageObj.src);
        reject(new Error("Image decoding failed"));
      };
    });
  }
}

/** Pixel size of a decoded image or a canvas. */
function sourceSize(source: ImageSource) {
  return source instanceof HTMLCanvasElement
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight };
}

export class LoadedImage {
  constructor(
    private _source: ImageSource,
    private _canvasService: CanvasService,
  ) {}
  get width() {
    return sourceSize(this._source).width;
  }
  get height() {
    return sourceSize(this._source).height;
  }
  resize(options: ResizeOptions = {}): ResizedImage {
    const size = { width: this.width, height: this.height };
    const target =
      options.targetSize ??
      (options.cover
        ? coverSize(size, options.cover, options.maxEdge)
        : fitWithin(size, options.maxEdge));
    const canvas = this._canvasService.drawToCanvas(this._source, target);
    return new ResizedImage(
      canvas,
      options.quality ?? 0.9,
      options.mimeType ?? "image/webp",
    );
  }
  /** Frees the object URL behind a decoded blob; a no-op for canvas sources. */
  release() {
    if (this._source instanceof HTMLImageElement) URL.revokeObjectURL(this._source.src);
  }
}

class ResizedImage {
  constructor(
    private canvas: HTMLCanvasElement,
    private quality: number,
    private mimeType: "image/webp" | "image/jpeg",
  ) {}
  get url() {
    return this.canvas.toDataURL();
  }
  get blob() {
    return canvasToBlob(this.canvas, this.mimeType, this.quality);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas to blob failed"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

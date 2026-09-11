export type ResizeOptions = {
  quality?: number;
  /** Exact output size; the image is letterboxed into it. */
  targetSize?: { width: number; height: number };
  /** Cap the longer edge, keeping the aspect ratio. Ignored when `targetSize` is set. */
  maxEdge?: number;
  mimeType?: "image/webp" | "image/jpeg";
};

export class CanvasService {
  /** Decodes `file` once so several renditions can be drawn from it. */
  async load(file: Blob): Promise<LoadedImage> {
    const imageObj = await this._loadImage(file);
    return new LoadedImage(imageObj, this);
  }

  async getImageFromVideo(file: File): Promise<Blob> {
    const video = await this._loadVideo(file);
    return new Promise((resolve, reject) => {
      video.currentTime = 1;

      video.onseeked = async () => {
        try {
          const { canvas, ctx } = this._initCanvas({
            width: video.videoWidth,
            height: video.videoHeight,
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("Thumbnail blob is null"));
              resolve(blob);
            },
            "image/jpeg",
            1,
          );
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(video.src);
        }
      };

      video.onerror = (e) => reject(new Error("Video loading error" + e));
    });
  }

  drawToCanvas(imageObj: HTMLImageElement, target: { width: number; height: number }) {
    const { canvas, ctx } = this._initCanvas(target);
    const transform = this._getTransform(imageObj, canvas);
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
    return new Promise((resolve) => (imageObj.onload = () => resolve(imageObj)));
  }
  private _loadVideo(file: File): Promise<HTMLVideoElement> {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.preload = "metadata";
    return new Promise((resolve) => {
      video.onloadedmetadata = () => resolve(video);
    });
  }
}

export class LoadedImage {
  constructor(
    private _image: HTMLImageElement,
    private _canvasService: CanvasService,
  ) {}
  get width() {
    return this._image.naturalWidth;
  }
  get height() {
    return this._image.naturalHeight;
  }
  resize(options: ResizeOptions = {}): ResizedImage {
    const target = options.targetSize ?? this._fitWithin(options.maxEdge);
    const canvas = this._canvasService.drawToCanvas(this._image, target);
    return new ResizedImage(
      canvas,
      options.quality ?? 0.9,
      options.mimeType ?? "image/webp",
    );
  }
  release() {
    URL.revokeObjectURL(this._image.src);
  }
  private _fitWithin(maxEdge: number | undefined) {
    const { width, height } = this;
    const longest = Math.max(width, height);
    if (maxEdge === undefined || longest <= maxEdge) return { width, height };
    const scale = maxEdge / longest;
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
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
    return this._getBlobFromCanvas(this.canvas, this.quality);
  }
  private _getBlobFromCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error("Canvas to blob failed");
          }
          resolve(blob);
        },
        this.mimeType,
        quality,
      );
    });
  }
}

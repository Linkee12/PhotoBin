export class CanvasService {
  async resize(
    file: Blob,
    options: { quality?: number; targetSize?: { width: number; height: number } } = {},
  ): Promise<ResizedImage> {
    const imageObj = await this._loadImage(file);
    const canvas = this._getCanvasFromImage(imageObj, options.targetSize ?? imageObj);
    URL.revokeObjectURL(imageObj.src);

    return new ResizedImage(canvas, options.quality ?? 0.9);
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

  private _getCanvasFromImage(
    imageObj: HTMLImageElement,
    target: { width: number; height: number },
  ) {
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

class ResizedImage {
  constructor(
    private canvas: HTMLCanvasElement,
    private quality: number,
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
        "image/webp",
        quality,
      );
    });
  }
}

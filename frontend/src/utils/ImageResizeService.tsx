export class ImageResizeService {
  async resize(
    file: File,
    options: { quality?: number; targetSize?: { width: number; height: number } } = {},
  ): Promise<ResizedImage> {
    const imageObj = await this._loadImage(file);
    const canvas = this._getCanvasFromImage(imageObj, options.targetSize ?? imageObj);
    URL.revokeObjectURL(imageObj.src);

    return new ResizedImage(canvas, options.quality ?? 0.9);
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
  private _loadImage(file: File): Promise<HTMLImageElement> {
    const imageObj = new Image();
    imageObj.src = URL.createObjectURL(file);
    return new Promise((resolve) => (imageObj.onload = () => resolve(imageObj)));
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

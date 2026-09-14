/**
 * The one instance graph of the album's media services. They are stateless
 * apart from `UploadService`'s in-session resume state, which must be shared
 * by everything that uploads.
 */
import { CanvasService } from "./CanvasService";
import { CryptoService } from "./CryptoService";
import { DownloadService } from "./DownloadService";
import { ImageQueryService } from "./ImageQueryService";
import { RotateService } from "./RotateService";
import { UploadService } from "./UploadService";

export const cryptoService = new CryptoService();
export const canvasService = new CanvasService();
export const imageQueryService = new ImageQueryService(cryptoService);
export const uploadService = new UploadService(canvasService, cryptoService);
export const downloadService = new DownloadService(imageQueryService);
export const rotateService = new RotateService(
  canvasService,
  cryptoService,
  imageQueryService,
);

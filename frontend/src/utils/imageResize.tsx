export default async function imageResize(
  file: File,
): Promise<{ url: string; blob: Blob }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 300;
  canvas.height = 200;

  const imageObj = new Image();
  imageObj.src = URL.createObjectURL(file);
  if (!ctx) throw new Error("Canvas context is null");
  return new Promise((resolve) => {
    imageObj.onload = function () {
      const imageAspectRatio = imageObj.width / imageObj.height;
      const canvasAspectRatio = canvas.width / canvas.height;

      let drawWidth, drawHeight, offsetX, offsetY;
      if (imageAspectRatio > canvasAspectRatio) {
        drawHeight = canvas.height;
        drawWidth = imageObj.width * (canvas.height / imageObj.height);
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = canvas.width;
        drawHeight = imageObj.height * (canvas.width / imageObj.width);
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imageObj, offsetX, offsetY, drawWidth, drawHeight);

      const resizedImage = canvas.toDataURL();
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error("Canvas to blob failed");
        }
        resolve({ url: resizedImage, blob: blob });
      });
    };
  });
}

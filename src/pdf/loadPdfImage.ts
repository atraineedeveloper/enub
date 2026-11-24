/** Resolve only after the browser has loaded the image; reject on asset failure. */
export function loadPdfImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar el recurso PDF"));
    image.src = src;
  });
}

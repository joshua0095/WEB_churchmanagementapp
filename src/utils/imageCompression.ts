export interface CompressImageOptions {
  /** Longest edge, in pixels, after downscaling. */
  maxDimension?: number;
  /** Starting JPEG quality (0-1) before the iterative shrink-to-fit loop kicks in. */
  quality?: number;
  /** Target size, in bytes, for the encoded output. */
  maxBytes?: number;
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxDimension: 512,
  quality: 0.85,
  maxBytes: 400 * 1024,
};

/** Downscales and re-encodes an image file into a small JPEG data URL, entirely in the browser.
 * This app stores images as data URLs directly in the database (see AnnouncementsController) —
 * without this, a multi-megabyte phone photo would go straight into a JSON request and a text
 * column as-is. Draws onto a canvas capped at `maxDimension` on the longest edge, then lowers
 * JPEG quality step by step until the result fits under `maxBytes` (or quality bottoms out). */
export async function compressImageToDataUrl(file: File, options: CompressImageOptions = {}): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const { maxDimension } = { ...DEFAULT_OPTIONS, ...options };
  const image = await loadImage(file);
  const { width, height } = scaleToFit(image.naturalWidth, image.naturalHeight, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(image, 0, 0, width, height);

  return compressCanvasToDataUrl(canvas, options);
}

/** Same idea as compressImageToDataUrl, but starting from a crop rectangle (in the original
 * image's own pixel coordinates, as produced by a cropping UI) instead of the whole image —
 * used so what the user framed in the cropper is what actually gets saved. */
export async function cropImageToDataUrl(
  file: File,
  crop: PixelCrop,
  options: CompressImageOptions = {},
): Promise<string> {
  const { maxDimension } = { ...DEFAULT_OPTIONS, ...options };
  const image = await loadImage(file);
  const { width, height } = scaleToFit(crop.width, crop.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

  return compressCanvasToDataUrl(canvas, options);
}

function compressCanvasToDataUrl(canvas: HTMLCanvasElement, options: CompressImageOptions = {}): string {
  const { quality: startQuality, maxBytes } = { ...DEFAULT_OPTIONS, ...options };

  let quality = startQuality;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length * 0.75 > maxBytes && quality > 0.3) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image file."));
    };
    img.src = url;
  });
}

function scaleToFit(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const scale = maxDimension / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

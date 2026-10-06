import { compressImageToDataUrl } from "../../utils/imageCompression";

// Only the browser sees the original file — it is compressed to under 1MB before upload, so
// this can be generous (phone photos and print-ready posters are often 20MB+).
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const ASPECT_RATIO = 16 / 9;
const ASPECT_TOLERANCE = 0.02;

/** Big enough for a crisp 1920×1080 poster, small enough for a phone upload and a DB row. */
const POSTER_OPTIONS = { maxDimension: 1920, quality: 0.85, maxBytes: 900 * 1024 };

function readNaturalSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image file."));
    };
    img.src = url;
  });
}

function checkSourceFile(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a JPG or PNG image.");
  if (file.size > MAX_SOURCE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Image must be smaller than 50MB (yours is ${mb}MB).`);
  }
}

/** Announcement images keep their existing rule — 16:9 only, so they fill Home's card without
 * cropping — then get compressed in the browser before going into the JSON request. */
export async function prepareAnnouncementImage(file: File): Promise<string> {
  checkSourceFile(file);
  const { width, height } = await readNaturalSize(file);
  if (Math.abs(width / height - ASPECT_RATIO) > ASPECT_TOLERANCE) {
    throw new Error(`Image must have a 16:9 aspect ratio (yours is ${width}×${height}).`);
  }
  return compressImageToDataUrl(file, POSTER_OPTIONS);
}

/** Theme posters are shown with object-fit: cover, so any shape works (16:9 looks best).
 * Compressed in the browser, then uploaded as a file (the theme endpoint takes multipart). */
export async function prepareThemePoster(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  checkSourceFile(file);
  const dataUrl = await compressImageToDataUrl(file, POSTER_OPTIONS);
  return { blob: dataUrlToBlob(dataUrl), previewUrl: dataUrl };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

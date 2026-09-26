// Shrink the photo before upload: about 1568px on the long edge, JPEG at 0.85.
// iPhones hand the browser a JPEG already, but desktop Chrome can't decode
// HEIC, so for those we lazily load a WebAssembly decoder.

const LONG_EDGE = 1568;
const QUALITY = 0.85;
const THUMB_EDGE = 480;

export class UnreadablePhotoError extends Error {}

export interface PreparedPhoto {
  blob: Blob;
  /** Object URL for showing the photo on screen. */
  url: string;
  /** A small data URL for the Life List. */
  thumb: string;
}

async function isHeic(file: Blob): Promise<boolean> {
  if (/image\/hei[cf]/i.test(file.type)) return true;
  if (file instanceof File && /\.hei[cf]$/i.test(file.name)) return true;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...head);
  return ascii.slice(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii.slice(8, 12));
}

async function decodeWithImg(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // decode() has finished with the bytes; the element keeps its pixels.
    URL.revokeObjectURL(url);
  }
}

type Drawable = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file); // honors EXIF orientation by default
  } catch {
    // fall through
  }
  try {
    return await decodeWithImg(file);
  } catch {
    // fall through
  }
  if (await isHeic(file)) {
    const { heicTo } = await import("heic-to/next");
    return heicTo({ blob: file, type: "bitmap" });
  }
  throw new UnreadablePhotoError("We couldn't open that photo. Try a JPEG, PNG, or a screenshot.");
}

function size(img: Drawable) {
  return "naturalWidth" in img
    ? { w: img.naturalWidth, h: img.naturalHeight }
    : { w: img.width, h: img.height };
}

function draw(img: Drawable, longEdge: number): HTMLCanvasElement {
  const { w, h } = size(img);
  const scale = Math.min(1, longEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnreadablePhotoError("This browser couldn't prepare the photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const img = await decode(file);
  const canvas = draw(img, LONG_EDGE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new UnreadablePhotoError("This browser couldn't prepare the photo.");
  const thumb = draw(canvas, THUMB_EDGE).toDataURL("image/jpeg", 0.72);
  if ("close" in img) img.close();
  return { blob, url: URL.createObjectURL(blob), thumb };
}

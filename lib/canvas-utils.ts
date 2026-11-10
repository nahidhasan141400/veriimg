'use client';

import { runWorkerEmbedding, runWorkerExtraction } from './worker-client';
import { DEFAULT_DELTA, ExtractionResult, EmbeddingResult } from './watermark-engine';

export const BRAND_LOGO_PATH = '/Veriimg Secure Image Logo.png';

let cachedLogoPromise: Promise<HTMLCanvasElement | HTMLImageElement | null> | null = null;

/**
 * Removes any outer white background via edge flood-fill (preserving the white padlock inside
 * the blue shield) and crops to the tight bounding box of the logo so it renders cleanly
 * with zero background box.
 */
function extractCleanTransparentLogo(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return srcCanvas;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  // Key out the white background smoothly while preserving the sky-blue logo strokes
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a === 0) continue;

      // Sky-blue logo pixels have low red channel (r ~ 60-90) and high blue channel (b ~ 245-255),
      // while white background pixels have high r, g, b (> 230).
      const minChannel = Math.min(r, g, b);
      if (minChannel >= 232) {
        data[idx + 3] = 0;
      } else if (minChannel > 110) {
        // Smooth anti-aliased edge transition
        const ratio = (232 - minChannel) / (232 - 110);
        data[idx + 3] = Math.max(0, Math.min(255, Math.round(a * ratio)));
      }

      if (data[idx + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  if (maxX <= minX || maxY <= minY) {
    return srcCanvas;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  if (outCtx) {
    outCtx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  }
  return outCanvas;
}

/**
 * Loads and caches the transparent, tightly cropped brand logo from /public.
 */
export function getBrandLogoImage(): Promise<HTMLCanvasElement | HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!cachedLogoPromise) {
    cachedLogoPromise = loadImageElement(BRAND_LOGO_PATH)
      .then((img) => extractCleanTransparentLogo(img))
      .catch(() => null);
  }
  return cachedLogoPromise;
}

/**
 * Loads an image from a URL or File/Blob into an HTMLImageElement.
 */
export function loadImageElement(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(
        new Error('Could not decode image file. Ensure the file is a valid PNG, JPEG, or WebP image.')
      );
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
}

/**
 * Extracts raw RGBA ImageData from an HTMLImageElement at its native resolution
 * (capped at 2000px max dimension for consistent sub-300ms performance).
 */
export function getImageDataFromImage(
  img: HTMLImageElement,
  maxDimension: number = 1600
): { imageData: ImageData; width: number; height: number; previewDataUrl: string } {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.max(40, Math.round(width * scale));
    height = Math.max(40, Math.round(height * scale));
  }

  // Ensure at least 40x40 for 20x20 grid
  width = Math.max(40, width);
  height = Math.max(40, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('2D Canvas context is unavailable in this browser.');
  }

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const previewDataUrl = canvas.toDataURL('image/png');
  return { imageData, width, height, previewDataUrl };
}

/**
 * Generates a compact JPEG thumbnail data URL (< 35KB) for Firestore inventory storage.
 */
export function createCompactThumbnail(imgOrCanvas: HTMLImageElement | HTMLCanvasElement): string {
  const thumbCanvas = document.createElement('canvas');
  const targetWidth = 160;
  const srcW =
    imgOrCanvas instanceof HTMLImageElement
      ? imgOrCanvas.naturalWidth || imgOrCanvas.width
      : imgOrCanvas.width;
  const srcH =
    imgOrCanvas instanceof HTMLImageElement
      ? imgOrCanvas.naturalHeight || imgOrCanvas.height
      : imgOrCanvas.height;
  const targetHeight = Math.max(90, Math.round((srcH / Math.max(1, srcW)) * targetWidth));

  thumbCanvas.width = targetWidth;
  thumbCanvas.height = targetHeight;
  const ctx = thumbCanvas.getContext('2d');
  if (!ctx) return '/samples/watch.jpg';
  ctx.drawImage(imgOrCanvas, 0, 0, targetWidth, targetHeight);
  return thumbCanvas.toDataURL('image/jpeg', 0.72);
}

/**
 * Draws a small, background-free veriimg logo watermark in the bottom-right corner of the canvas.
 * Placed strictly in the lower-right region (y >= 75% H), preserving rows 0 and 1 where
 * the 32-bit spatial watermark blocks B0..B31 reside.
 */
function drawCornerLogoOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  logoSource: HTMLCanvasElement | HTMLImageElement | null
): void {
  if (!logoSource) return;

  const naturalW =
    logoSource instanceof HTMLImageElement
      ? logoSource.naturalWidth || logoSource.width || 300
      : logoSource.width || 300;
  const naturalH =
    logoSource instanceof HTMLImageElement
      ? logoSource.naturalHeight || logoSource.height || 80
      : logoSource.height || 80;
  const aspect = naturalW / Math.max(1, naturalH);

  // Small, unobtrusive logo size (~8% of image width, clamped between 44px and 88px)
  const logoW = Math.max(44, Math.min(88, Math.round(width * 0.085)));
  const logoH = Math.max(12, Math.round(logoW / aspect));

  const margin = Math.max(8, Math.round(Math.min(width, height) * 0.016));
  const x = Math.max(4, width - logoW - margin);
  const y = Math.max(Math.ceil((height / 20) * 3), height - logoH - margin);

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.drawImage(logoSource, x, y, logoW, logoH);
  ctx.restore();
}

/**
 * Synchronous raw pixels-to-canvas converter (used internally for R&D Lab compression tests).
 */
export function pixelsToPngDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): { pngDataUrl: string; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D Canvas context is unavailable.');
  }
  const imgData = new ImageData(new Uint8ClampedArray(pixels), width, height);
  ctx.putImageData(imgData, 0, 0);
  return { pngDataUrl: canvas.toDataURL('image/png'), canvas };
}

/**
 * Converts an EmbeddingResult RGBA buffer into a watermarked PNG data URL and stamps
 * the small veriimg brand logo in the bottom-right corner for downloaded/exported assets.
 */
export async function pixelsToWatermarkedPngWithLogo(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Promise<{ pngDataUrl: string; canvas: HTMLCanvasElement }> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D Canvas context is unavailable.');
  }
  const imgData = new ImageData(new Uint8ClampedArray(pixels), width, height);
  ctx.putImageData(imgData, 0, 0);

  const logoImg = await getBrandLogoImage();
  drawCornerLogoOnCanvas(ctx, width, height, logoImg);

  return { pngDataUrl: canvas.toDataURL('image/png'), canvas };
}

/**
 * Triggers a browser file download for a PNG data URL.
 */
export function triggerPngDownload(pngDataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = pngDataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Generates an on-the-fly watermarked PNG (including the bottom-right veriimg logo watermark)
 * from a sample image URL and integer ID, returning both the PNG data URL and EmbeddingResult.
 */
export async function createWatermarkedSampleFromUrl(
  sampleUrl: string,
  id: number,
  delta: number = DEFAULT_DELTA
): Promise<{ pngDataUrl: string; embedding: EmbeddingResult; thumbnailDataUrl: string }> {
  const img = await loadImageElement(sampleUrl);
  const { imageData } = getImageDataFromImage(img, 800);
  const embedding = await runWorkerEmbedding(imageData, id, delta);
  const { pngDataUrl, canvas } = await pixelsToWatermarkedPngWithLogo(
    embedding.pixels,
    embedding.width,
    embedding.height
  );
  const thumbnailDataUrl = createCompactThumbnail(canvas);
  return { pngDataUrl, embedding, thumbnailDataUrl };
}

/**
 * Simulates lossy JPEG compression at quality Q in [10, 100] and proportional scaling
 * for the R&D Lab Tuning Sandbox, returning the post-compression ExtractionResult.
 */
export async function simulateCompressionAndExtract(
  watermarkedPixels: Uint8ClampedArray,
  width: number,
  height: number,
  jpegQualityPercent: number,
  resizeScalePercent: number = 100,
  delta: number = DEFAULT_DELTA
): Promise<{
  extracted: ExtractionResult;
  compressedPreviewUrl: string;
}> {
  const { canvas } = await pixelsToWatermarkedPngWithLogo(watermarkedPixels, width, height);

  // Apply proportional resize if requested (NFR-ROB-02)
  const scale = Math.max(0.25, Math.min(1.5, resizeScalePercent / 100));
  const scaledW = Math.max(40, Math.round(width * scale));
  const scaledH = Math.max(40, Math.round(height * scale));

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = scaledW;
  scaledCanvas.height = scaledH;
  const sCtx = scaledCanvas.getContext('2d');
  if (!sCtx) throw new Error('Canvas context unavailable');
  sCtx.drawImage(canvas, 0, 0, scaledW, scaledH);

  const quality = Math.max(0.1, Math.min(1.0, jpegQualityPercent / 100));
  const jpegDataUrl = scaledCanvas.toDataURL('image/jpeg', quality);

  const reloadedImg = await loadImageElement(jpegDataUrl);
  const { imageData } = getImageDataFromImage(reloadedImg, 1600);
  const extracted = await runWorkerExtraction(imageData, {
    includeFullGrid: true,
    delta,
  });

  return {
    extracted,
    compressedPreviewUrl: jpegDataUrl,
  };
}

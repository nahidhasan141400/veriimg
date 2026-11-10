/**
 * veriimg — Spatial Luminance Watermarking & Extraction Engine
 * Implements ITU-R BT.601 luminance calculation across a 20x20 spatial grid
 * (400 blocks, using B_0..B_31 for 32-bit unsigned integer encoding/decoding).
 */

export const GRID_COLUMNS = 20;
export const GRID_ROWS = 20;
export const TOTAL_GRID_BLOCKS = GRID_COLUMNS * GRID_ROWS; // 400
export const WATERMARK_BIT_COUNT = 32;
export const LUMINANCE_THRESHOLD = 128;
export const DEFAULT_DELTA = 10;
export const MAX_UINT32 = 4294967295; // 2^32 - 1

// Blueprint-synchronized validation constants
export const HEX_REGEX = /^0x[0-9A-F]{8}$/;
export const BINARY32_REGEX = /^[01]{32}$/;
export const HTTPS_URL_REGEX = /^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/;
export const WATERMARK_ID_STRING_REGEX = /^[0-9]{1,10}$/;
export const MAX_URL_LENGTH = 512;
export const MIN_URL_LENGTH = 8;
export const MAX_TITLE_LENGTH = 120;
export const MAX_THUMBNAIL_LENGTH = 150000;

export interface BlockCoord {
  index: number;
  row: number;
  col: number;
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
  width: number;
  height: number;
}

export interface BlockLuminanceMetric extends BlockCoord {
  avgLuminance: number;
  bit: 0 | 1;
  marginFromThreshold: number;
  clearsDelta: boolean;
}

export interface ExtractionResult {
  id: number;
  hex: string;
  binary: string;
  blocks: BlockLuminanceMetric[];
  allGridLuminance?: number[];
  width: number;
  height: number;
  deltaX: number;
  deltaY: number;
  durationMs: number;
  confidenceScore: number;
}

export interface EmbeddingResult {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  id: number;
  hex: string;
  binary: string;
  delta: number;
  beforeBlocks: BlockLuminanceMetric[];
  afterBlocks: BlockLuminanceMetric[];
  durationMs: number;
}

/**
 * Converts an unsigned 32-bit integer N in [0, 2^32 - 1] to a 32-char binary string (MSB b_0 to LSB b_31).
 */
export function intToBinary32(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_UINT32) {
    throw new RangeError(`Integer ID must be an integer in [0, ${MAX_UINT32}], received: ${n}`);
  }
  return (n >>> 0).toString(2).padStart(32, '0');
}

/**
 * Converts an unsigned 32-bit integer N in [0, 2^32 - 1] to an 8-character uppercase hex code prefixed with 0x.
 */
export function intToHex32(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_UINT32) {
    throw new RangeError(`Integer ID must be an integer in [0, ${MAX_UINT32}], received: ${n}`);
  }
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Parses a 32-character binary string (b_0 MSB .. b_31 LSB) into an unsigned 32-bit integer.
 */
export function binary32ToInt(binary: string): number {
  if (!BINARY32_REGEX.test(binary)) {
    throw new Error(`Invalid 32-bit binary sequence: "${binary}"`);
  }
  return parseInt(binary, 2) >>> 0;
}

/**
 * Validates and sanitizes an administrative https:// target URL (NFR-SEC-03).
 */
export function sanitizeAndValidateHttpsUrl(rawUrl: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, sanitized: '', error: 'Destination URL is required.' };
  }
  if (!trimmed.startsWith('https://')) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'URL must use the secure https:// protocol.',
    };
  }
  if (trimmed.length < MIN_URL_LENGTH || trimmed.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      sanitized: trimmed,
      error: `URL length must be between ${MIN_URL_LENGTH} and ${MAX_URL_LENGTH} characters.`,
    };
  }
  if (!HTTPS_URL_REGEX.test(trimmed)) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Enter a valid https:// domain and path (e.g., https://brand.example.com/item).',
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, sanitized: trimmed, error: 'Only https:// URLs are permitted.' };
    }
    return { valid: true, sanitized: trimmed };
  } catch {
    return { valid: false, sanitized: trimmed, error: 'Malformed URL syntax.' };
  }
}

/**
 * Computes block geometry for block index k in [0, 399] on a WxH canvas.
 * \Delta x = floor(W / 20), \Delta y = floor(H / 20)
 * c = k mod 20, r = floor(k / 20)
 */
export function getBlockCoordinates(k: number, width: number, height: number): BlockCoord {
  const deltaX = Math.floor(width / GRID_COLUMNS);
  const deltaY = Math.floor(height / GRID_ROWS);
  if (deltaX < 1 || deltaY < 1) {
    throw new Error(`Image dimensions (${width}x${height}) are too small for a 20x20 grid.`);
  }
  const col = k % GRID_COLUMNS;
  const row = Math.floor(k / GRID_COLUMNS);
  const xStart = col * deltaX;
  const yStart = row * deltaY;
  return {
    index: k,
    row,
    col,
    xStart,
    yStart,
    xEnd: xStart + deltaX,
    yEnd: yStart + deltaY,
    width: deltaX,
    height: deltaY,
  };
}

/**
 * ITU-R BT.601 pixel luminance: Y = 0.299*R + 0.587*G + 0.114*B
 */
export function calculatePixelLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Computes average luminance \bar{Y}_k of block B_k inside an RGBA pixel buffer.
 */
export function computeBlockAverageLuminance(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  k: number
): { avgLuminance: number; coord: BlockCoord } {
  const coord = getBlockCoordinates(k, imageWidth, imageHeight);
  const totalPixels = coord.width * coord.height;
  let sumY = 0;

  for (let y = coord.yStart; y < coord.yEnd; y++) {
    const rowOffset = y * imageWidth;
    for (let x = coord.xStart; x < coord.xEnd; x++) {
      const idx = (rowOffset + x) * 4;
      sumY +=
        0.299 * pixels[idx] +
        0.587 * pixels[idx + 1] +
        0.114 * pixels[idx + 2];
    }
  }

  return {
    avgLuminance: sumY / totalPixels,
    coord,
  };
}

/**
 * Modulates a single block B_k in place so its average luminance satisfies:
 * - If targetBit === 1: \bar{Y}_k >= 128 + delta
 * - If targetBit === 0: \bar{Y}_k < 128 - delta
 * Uses iterative proportional scaling with an additive floor so even solid black (0,0,0)
 * or solid white (255,255,255) blocks converge accurately within 16 steps.
 */
export function modulateBlockLuminanceInPlace(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  k: number,
  targetBit: 0 | 1,
  delta: number = DEFAULT_DELTA
): void {
  const safeDelta = Math.max(1, Math.min(64, Math.round(delta)));
  const upperTarget = Math.min(245, LUMINANCE_THRESHOLD + safeDelta);
  const lowerTarget = Math.max(10, LUMINANCE_THRESHOLD - safeDelta - 0.5);

  for (let iter = 0; iter < 24; iter++) {
    const { avgLuminance, coord } = computeBlockAverageLuminance(
      pixels,
      imageWidth,
      imageHeight,
      k
    );

    if (targetBit === 1 && avgLuminance >= upperTarget) {
      return;
    }
    if (targetBit === 0 && avgLuminance < lowerTarget) {
      return;
    }

    if (targetBit === 1) {
      // Need to raise luminance to at least upperTarget
      const deficit = upperTarget - avgLuminance + 1.5;
      const scale = avgLuminance > 12 ? Math.min(1.35, (avgLuminance + deficit * 0.65) / avgLuminance) : 1.0;
      const additive = avgLuminance <= 12 ? Math.ceil(deficit) : Math.ceil(deficit * 0.45);

      for (let y = coord.yStart; y < coord.yEnd; y++) {
        const rowOffset = y * imageWidth;
        for (let x = coord.xStart; x < coord.xEnd; x++) {
          const idx = (rowOffset + x) * 4;
          pixels[idx] = Math.min(255, Math.round(pixels[idx] * scale + additive));
          pixels[idx + 1] = Math.min(255, Math.round(pixels[idx + 1] * scale + additive));
          pixels[idx + 2] = Math.min(255, Math.round(pixels[idx + 2] * scale + additive));
        }
      }
    } else {
      // Need to lower luminance below lowerTarget
      const excess = avgLuminance - lowerTarget + 1.5;
      const scale = avgLuminance > 1 ? Math.max(0.5, (avgLuminance - excess * 0.85) / avgLuminance) : 0;
      const subtractive = Math.ceil(excess * 0.25);

      for (let y = coord.yStart; y < coord.yEnd; y++) {
        const rowOffset = y * imageWidth;
        for (let x = coord.xStart; x < coord.xEnd; x++) {
          const idx = (rowOffset + x) * 4;
          pixels[idx] = Math.max(0, Math.floor(pixels[idx] * scale - subtractive));
          pixels[idx + 1] = Math.max(0, Math.floor(pixels[idx + 1] * scale - subtractive));
          pixels[idx + 2] = Math.max(0, Math.floor(pixels[idx + 2] * scale - subtractive));
        }
      }
    }
  }
}

/**
 * Inspects the first 32 blocks B_0..B_31 and resolves the 32-bit identifier.
 */
export function extractWatermarkFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { includeFullGrid?: boolean; delta?: number }
): ExtractionResult {
  const startTime = performance.now();
  const delta = options?.delta ?? DEFAULT_DELTA;
  const blocks: BlockLuminanceMetric[] = [];
  let binary = '';
  let clearCount = 0;

  for (let k = 0; k < WATERMARK_BIT_COUNT; k++) {
    const { avgLuminance, coord } = computeBlockAverageLuminance(pixels, width, height, k);
    const bit: 0 | 1 = avgLuminance >= LUMINANCE_THRESHOLD ? 1 : 0;
    binary += bit.toString();

    const marginFromThreshold = Math.abs(avgLuminance - LUMINANCE_THRESHOLD);
    const clearsDelta =
      bit === 1
        ? avgLuminance >= LUMINANCE_THRESHOLD + delta - 0.5
        : avgLuminance < LUMINANCE_THRESHOLD - delta + 0.5;
    if (clearsDelta) {
      clearCount++;
    }

    blocks.push({
      ...coord,
      avgLuminance: Number(avgLuminance.toFixed(2)),
      bit,
      marginFromThreshold: Number(marginFromThreshold.toFixed(2)),
      clearsDelta,
    });
  }

  let allGridLuminance: number[] | undefined;
  if (options?.includeFullGrid) {
    allGridLuminance = [];
    for (let k = 0; k < TOTAL_GRID_BLOCKS; k++) {
      if (k < WATERMARK_BIT_COUNT) {
        allGridLuminance.push(blocks[k].avgLuminance);
      } else {
        const { avgLuminance } = computeBlockAverageLuminance(pixels, width, height, k);
        allGridLuminance.push(Number(avgLuminance.toFixed(1)));
      }
    }
  }

  const id = binary32ToInt(binary);
  const hex = intToHex32(id);
  const durationMs = Number(Math.max(0.1, performance.now() - startTime).toFixed(2));

  return {
    id,
    hex,
    binary,
    blocks,
    allGridLuminance,
    width,
    height,
    deltaX: Math.floor(width / GRID_COLUMNS),
    deltaY: Math.floor(height / GRID_ROWS),
    durationMs,
    confidenceScore: Number(((clearCount / WATERMARK_BIT_COUNT) * 100).toFixed(1)),
  };
}

/**
 * Embeds a 32-bit unsigned integer N into blocks B_0..B_31 of a cloned RGBA pixel buffer.
 */
export function embedWatermarkIntoPixels(
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
  id: number,
  delta: number = DEFAULT_DELTA
): EmbeddingResult {
  const startTime = performance.now();
  const binary = intToBinary32(id);
  const hex = intToHex32(id);

  const beforeExtraction = extractWatermarkFromPixels(sourcePixels, width, height, { delta });
  const modulated = new Uint8ClampedArray(sourcePixels);

  for (let k = 0; k < WATERMARK_BIT_COUNT; k++) {
    const bit: 0 | 1 = binary[k] === '1' ? 1 : 0;
    modulateBlockLuminanceInPlace(modulated, width, height, k, bit, delta);
  }

  const afterExtraction = extractWatermarkFromPixels(modulated, width, height, { delta });
  const durationMs = Number(Math.max(0.1, performance.now() - startTime).toFixed(2));

  return {
    pixels: modulated,
    width,
    height,
    id,
    hex,
    binary,
    delta,
    beforeBlocks: beforeExtraction.blocks,
    afterBlocks: afterExtraction.blocks,
    durationMs,
  };
}

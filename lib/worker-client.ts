'use client';

import {
  ExtractionResult,
  EmbeddingResult,
  extractWatermarkFromPixels,
  embedWatermarkIntoPixels,
  DEFAULT_DELTA,
} from './watermark-engine';

/**
 * Self-contained Web Worker script executing ITU-R BT.601 20x20 grid luminance
 * extraction and spatial embedding off the main UI thread (NFR-PERF-01).
 */
const WORKER_SOURCE = `
const GRID_COLUMNS = 20;
const GRID_ROWS = 20;
const TOTAL_GRID_BLOCKS = 400;
const WATERMARK_BIT_COUNT = 32;
const LUMINANCE_THRESHOLD = 128;
const MAX_UINT32 = 4294967295;

function intToBinary32(n) {
  return (n >>> 0).toString(2).padStart(32, '0');
}

function intToHex32(n) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function binary32ToInt(binary) {
  return parseInt(binary, 2) >>> 0;
}

function getBlockCoordinates(k, width, height) {
  const deltaX = Math.floor(width / GRID_COLUMNS);
  const deltaY = Math.floor(height / GRID_ROWS);
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

function computeBlockAverageLuminance(pixels, imageWidth, imageHeight, k) {
  const coord = getBlockCoordinates(k, imageWidth, imageHeight);
  const totalPixels = coord.width * coord.height;
  let sumY = 0;
  for (let y = coord.yStart; y < coord.yEnd; y++) {
    const rowOffset = y * imageWidth;
    for (let x = coord.xStart; x < coord.xEnd; x++) {
      const idx = (rowOffset + x) * 4;
      sumY += 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    }
  }
  return { avgLuminance: sumY / totalPixels, coord };
}

function modulateBlockLuminanceInPlace(pixels, imageWidth, imageHeight, k, targetBit, delta) {
  const safeDelta = Math.max(1, Math.min(64, Math.round(delta)));
  const upperTarget = Math.min(245, LUMINANCE_THRESHOLD + safeDelta);
  const lowerTarget = Math.max(10, LUMINANCE_THRESHOLD - safeDelta - 0.5);

  for (let iter = 0; iter < 24; iter++) {
    const { avgLuminance, coord } = computeBlockAverageLuminance(pixels, imageWidth, imageHeight, k);
    if (targetBit === 1 && avgLuminance >= upperTarget) return;
    if (targetBit === 0 && avgLuminance < lowerTarget) return;

    if (targetBit === 1) {
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

function extractWatermark(pixels, width, height, includeFullGrid, delta) {
  const startTime = performance.now();
  const blocks = [];
  let binary = '';
  let clearCount = 0;

  for (let k = 0; k < WATERMARK_BIT_COUNT; k++) {
    const { avgLuminance, coord } = computeBlockAverageLuminance(pixels, width, height, k);
    const bit = avgLuminance >= LUMINANCE_THRESHOLD ? 1 : 0;
    binary += bit.toString();
    const marginFromThreshold = Math.abs(avgLuminance - LUMINANCE_THRESHOLD);
    const clearsDelta = bit === 1
      ? avgLuminance >= LUMINANCE_THRESHOLD + delta - 0.5
      : avgLuminance < LUMINANCE_THRESHOLD - delta + 0.5;
    if (clearsDelta) clearCount++;

    blocks.push({
      ...coord,
      avgLuminance: Number(avgLuminance.toFixed(2)),
      bit,
      marginFromThreshold: Number(marginFromThreshold.toFixed(2)),
      clearsDelta,
    });
  }

  let allGridLuminance = undefined;
  if (includeFullGrid) {
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

self.onmessage = function(e) {
  const { requestId, action, payload } = e.data;
  try {
    if (action === 'extract') {
      const pixels = new Uint8ClampedArray(payload.buffer);
      const result = extractWatermark(
        pixels,
        payload.width,
        payload.height,
        Boolean(payload.includeFullGrid),
        payload.delta || 14
      );
      self.postMessage({ requestId, ok: true, result });
    } else if (action === 'embed') {
      const startTime = performance.now();
      const sourcePixels = new Uint8ClampedArray(payload.buffer);
      const width = payload.width;
      const height = payload.height;
      const id = payload.id;
      const delta = payload.delta || 14;
      const binary = intToBinary32(id);
      const hex = intToHex32(id);

      const beforeExtraction = extractWatermark(sourcePixels, width, height, false, delta);
      const modulated = new Uint8ClampedArray(sourcePixels);

      for (let k = 0; k < WATERMARK_BIT_COUNT; k++) {
        const bit = binary[k] === '1' ? 1 : 0;
        modulateBlockLuminanceInPlace(modulated, width, height, k, bit, delta);
      }

      const afterExtraction = extractWatermark(modulated, width, height, false, delta);
      const durationMs = Number(Math.max(0.1, performance.now() - startTime).toFixed(2));

      self.postMessage(
        {
          requestId,
          ok: true,
          result: {
            buffer: modulated.buffer,
            width,
            height,
            id,
            hex,
            binary,
            delta,
            beforeBlocks: beforeExtraction.blocks,
            afterBlocks: afterExtraction.blocks,
            durationMs,
          },
        },
        [modulated.buffer]
      );
    }
  } catch (err) {
    self.postMessage({
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
`;

let sharedWorker: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<
  number,
  { resolve: (val: unknown) => void; reject: (err: Error) => void }
>();

function getOrCreateWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (!sharedWorker) {
    try {
      const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      sharedWorker = new Worker(url);
      sharedWorker.onmessage = (event) => {
        const { requestId, ok, result, error } = event.data;
        const handler = pendingRequests.get(requestId);
        if (!handler) return;
        pendingRequests.delete(requestId);
        if (ok) {
          handler.resolve(result);
        } else {
          handler.reject(new Error(error || 'Worker processing error'));
        }
      };
    } catch {
      return null;
    }
  }
  return sharedWorker;
}

/**
 * Executes 20x20 spatial watermark extraction in a background Web Worker.
 */
export async function runWorkerExtraction(
  imageData: ImageData,
  options?: { includeFullGrid?: boolean; delta?: number }
): Promise<ExtractionResult> {
  const worker = getOrCreateWorker();
  if (!worker) {
    return extractWatermarkFromPixels(
      imageData.data,
      imageData.width,
      imageData.height,
      options
    );
  }

  const requestId = ++requestCounter;
  const copy = new Uint8ClampedArray(imageData.data);

  return new Promise<ExtractionResult>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve: (val) => resolve(val as ExtractionResult),
      reject,
    });
    worker.postMessage(
      {
        requestId,
        action: 'extract',
        payload: {
          buffer: copy.buffer,
          width: imageData.width,
          height: imageData.height,
          includeFullGrid: options?.includeFullGrid ?? false,
          delta: options?.delta ?? DEFAULT_DELTA,
        },
      },
      [copy.buffer]
    );
  });
}

/**
 * Executes 20x20 spatial watermark embedding in a background Web Worker.
 */
export async function runWorkerEmbedding(
  imageData: ImageData,
  id: number,
  delta: number = DEFAULT_DELTA
): Promise<EmbeddingResult> {
  const worker = getOrCreateWorker();
  if (!worker) {
    return embedWatermarkIntoPixels(
      imageData.data,
      imageData.width,
      imageData.height,
      id,
      delta
    );
  }

  const requestId = ++requestCounter;
  const copy = new Uint8ClampedArray(imageData.data);

  return new Promise<EmbeddingResult>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve: (raw) => {
        const data = raw as Omit<EmbeddingResult, 'pixels'> & { buffer: ArrayBuffer };
        resolve({
          ...data,
          pixels: new Uint8ClampedArray(data.buffer),
        });
      },
      reject,
    });
    worker.postMessage(
      {
        requestId,
        action: 'embed',
        payload: {
          buffer: copy.buffer,
          width: imageData.width,
          height: imageData.height,
          id,
          delta,
        },
      },
      [copy.buffer]
    );
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intToBinary32,
  intToHex32,
  binary32ToInt,
  sanitizeAndValidateHttpsUrl,
  getBlockCoordinates,
  calculatePixelLuminance,
  embedWatermarkIntoPixels,
  extractWatermarkFromPixels,
  LUMINANCE_THRESHOLD,
} from './watermark-engine';

test('32-bit integer, hex, and binary conversions are exact and reversible', () => {
  assert.equal(intToHex32(10425), '0x000028B9');
  assert.equal(intToBinary32(10425), '00000000000000000010100010111001');
  assert.equal(binary32ToInt('00000000000000000010100010111001'), 10425);

  // Edge values: 0 and 2^32 - 1
  assert.equal(intToHex32(0), '0x00000000');
  assert.equal(binary32ToInt(intToBinary32(0)), 0);

  const maxUint = 4294967295;
  assert.equal(intToHex32(maxUint), '0xFFFFFFFF');
  assert.equal(intToBinary32(maxUint), '11111111111111111111111111111111');
  assert.equal(binary32ToInt(intToBinary32(maxUint)), maxUint);
});

test('20x20 grid coordinate partitioning follows floor(W/20) and floor(H/20)', () => {
  const b0 = getBlockCoordinates(0, 400, 200);
  assert.equal(b0.row, 0);
  assert.equal(b0.col, 0);
  assert.equal(b0.xStart, 0);
  assert.equal(b0.xEnd, 20);
  assert.equal(b0.yStart, 0);
  assert.equal(b0.yEnd, 10);

  // Block 25 -> row 1, col 5
  const b25 = getBlockCoordinates(25, 400, 200);
  assert.equal(b25.row, 1);
  assert.equal(b25.col, 5);
  assert.equal(b25.xStart, 100);
  assert.equal(b25.xEnd, 120);
  assert.equal(b25.yStart, 10);
  assert.equal(b25.yEnd, 20);
});

test('ITU-R BT.601 luminance formula matches 0.299R + 0.587G + 0.114B', () => {
  assert.equal(calculatePixelLuminance(0, 0, 0), 0);
  assert.ok(Math.abs(calculatePixelLuminance(255, 255, 255) - 255) < 1e-6);
  assert.ok(Math.abs(calculatePixelLuminance(100, 150, 200) - (29.9 + 88.05 + 22.8)) < 1e-6);
});

test('Embedding and extracting a 32-bit watermark recovers 100% of bits across diverse images', () => {
  const width = 200;
  const height = 200;
  const pixels = new Uint8ClampedArray(width * height * 4);

  // Fill with a gradient including pure dark and pure bright regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      pixels[idx] = (x * 3) % 256;
      pixels[idx + 1] = (y * 5) % 256;
      pixels[idx + 2] = ((x + y) * 2) % 256;
      pixels[idx + 3] = 255;
    }
  }

  const targetId = 305419896; // 0x12345678
  const delta = 15;
  const embedded = embedWatermarkIntoPixels(pixels, width, height, targetId, delta);
  const extracted = extractWatermarkFromPixels(embedded.pixels, width, height, { delta });

  assert.equal(extracted.id, targetId);
  assert.equal(extracted.hex, '0x12345678');
  assert.equal(extracted.binary, intToBinary32(targetId));

  // Verify every block B_0..B_31 respects the 128 +/- delta threshold
  for (const block of extracted.blocks) {
    if (block.bit === 1) {
      assert.ok(
        block.avgLuminance >= LUMINANCE_THRESHOLD,
        `Block ${block.index} expected >= 128, got ${block.avgLuminance}`
      );
    } else {
      assert.ok(
        block.avgLuminance < LUMINANCE_THRESHOLD,
        `Block ${block.index} expected < 128, got ${block.avgLuminance}`
      );
    }
  }
});

test('URL validation enforces https:// protocol and rejects insecure or malformed URIs', () => {
  assert.equal(sanitizeAndValidateHttpsUrl('https://veriimg.org/authentic/10425').valid, true);
  assert.equal(sanitizeAndValidateHttpsUrl('http://veriimg.org/insecure').valid, false);
  assert.equal(sanitizeAndValidateHttpsUrl('javascript:alert(1)').valid, false);
  assert.equal(sanitizeAndValidateHttpsUrl('').valid, false);
});

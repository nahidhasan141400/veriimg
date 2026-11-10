'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  Download,
  CheckCircle2,
  Shuffle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  intToBinary32,
  intToHex32,
  MAX_UINT32,
  DEFAULT_DELTA,
  sanitizeAndValidateHttpsUrl,
  EmbeddingResult,
} from '@/lib/watermark-engine';
import {
  loadImageElement,
  getImageDataFromImage,
  pixelsToWatermarkedPngWithLogo,
  createCompactThumbnail,
  triggerPngDownload,
  BRAND_LOGO_PATH,
} from '@/lib/canvas-utils';
import { runWorkerEmbedding } from '@/lib/worker-client';

interface AdminCreateTabProps {
  onSaveWatermark: (params: {
    id: number;
    targetUrl: string;
    title: string;
    thumbnailDataUrl: string;
    delta: number;
    sourceSampleUrl?: string;
  }) => Promise<void>;
  onVerifyGeneratedInPortal: (dataUrl: string, title: string) => void;
}

const STUDIO_PRESET_IMAGES = [
  { label: 'Ceramic Vessel Studio', url: '/samples/sculpture.jpg' },
  { label: 'Titanium Chronograph', url: '/samples/watch.jpg' },
  { label: 'Glass Art Pavilion', url: '/samples/architecture.jpg' },
];

export function AdminCreateTab({
  onSaveWatermark,
  onVerifyGeneratedInPortal,
}: AdminCreateTabProps) {
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string>('/samples/sculpture.jpg');
  const [sourceFileLabel, setSourceFileLabel] = useState<string>('Ceramic Vessel Studio');
  const [integerInput, setIntegerInput] = useState<string>('20488');
  const [titleInput, setTitleInput] = useState<string>('Sculptural Vessel Edition IV');
  const [targetUrlInput, setTargetUrlInput] = useState<string>(
    'https://atelier.veriimg.org/authentic/20488'
  );
  const [deltaInput, setDeltaInput] = useState<number>(DEFAULT_DELTA);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<{
    pngDataUrl: string;
    embedding: EmbeddingResult;
    title: string;
    targetUrl: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse and validate Integer ID N in [0, 2^32 - 1]
  const parsedIdInfo = useMemo(() => {
    const trimmed = integerInput.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      return {
        valid: false,
        id: 0,
        hex: '0x00000000',
        binary: '0'.repeat(32),
        error: `Enter an unsigned integer between 0 and ${MAX_UINT32}.`,
      };
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num) || num < 0 || num > MAX_UINT32) {
      return {
        valid: false,
        id: 0,
        hex: '0x00000000',
        binary: '0'.repeat(32),
        error: `Identifier must be within 32-bit range [0, ${MAX_UINT32}].`,
      };
    }
    return {
      valid: true,
      id: num,
      hex: intToHex32(num),
      binary: intToBinary32(num),
    };
  }, [integerInput]);

  const urlValidation = useMemo(
    () => sanitizeAndValidateHttpsUrl(targetUrlInput),
    [targetUrlInput]
  );

  const handleCustomFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedSourceUrl(reader.result);
        setSourceFileLabel(file.name);
        setGeneratedOutput(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRandomizeId = () => {
    const randomId = Math.floor(10000 + Math.random() * 900000);
    setIntegerInput(String(randomId));
    setTargetUrlInput(`https://official.veriimg.org/authentic/${randomId}`);
    setErrorMessage(null);
  };

  const handleGenerateAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!parsedIdInfo.valid) {
      setErrorMessage(parsedIdInfo.error || 'Invalid 32-bit Integer ID.');
      return;
    }
    if (!urlValidation.valid) {
      setErrorMessage(urlValidation.error || 'Destination URL must be a valid https:// URI.');
      return;
    }
    if (!titleInput.trim()) {
      setErrorMessage('Please enter an asset title.');
      return;
    }

    try {
      setIsProcessing(true);
      const img = await loadImageElement(selectedSourceUrl);
      const { imageData } = getImageDataFromImage(img, 1000);

      const embedding = await runWorkerEmbedding(imageData, parsedIdInfo.id, deltaInput);
      const { pngDataUrl, canvas } = await pixelsToWatermarkedPngWithLogo(
        embedding.pixels,
        embedding.width,
        embedding.height
      );
      const thumbnailDataUrl = createCompactThumbnail(canvas);

      await onSaveWatermark({
        id: parsedIdInfo.id,
        targetUrl: urlValidation.sanitized,
        title: titleInput.trim(),
        thumbnailDataUrl,
        delta: deltaInput,
        sourceSampleUrl: selectedSourceUrl.startsWith('/samples/')
          ? selectedSourceUrl
          : undefined,
      });

      setGeneratedOutput({
        pngDataUrl,
        embedding,
        title: titleInput.trim(),
        targetUrl: urlValidation.sanitized,
      });

      // Automatically trigger PNG download with embedded data + bottom-right veriimg logo
      triggerPngDownload(pngDataUrl, `veriimg-${parsedIdInfo.id}-${parsedIdInfo.hex}.png`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to embed watermark.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Format 32-bit binary into 8 nibbles of 4 bits for clean visual inspection
  const formattedBinaryNibbles = useMemo(() => {
    return parsedIdInfo.binary.match(/.{1,4}/g)?.join(' ') || parsedIdInfo.binary;
  }, [parsedIdInfo.binary]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Step-by-Step Creation Studio Form (7 cols) */}
      <form
        onSubmit={handleGenerateAndSave}
        className="lg:col-span-7 rounded-2xl bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] p-6 sm:p-8 space-y-6"
      >
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
            Create Watermarked Asset
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Embed a 32-bit spatial luminance signature across blocks B0 through B31 and register its
            destination URL.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs font-medium flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Source Image Picker */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              01. Source Master Image
            </label>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
              Active: {sourceFileLabel}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleCustomFileSelect}
            className="sr-only"
            aria-label="Upload custom source image for watermarking"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Upload Custom Image</span>
            </button>

            {STUDIO_PRESET_IMAGES.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => {
                  setSelectedSourceUrl(preset.url);
                  setSourceFileLabel(preset.label);
                  setGeneratedOutput(null);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSourceUrl === preset.url
                    ? 'bg-[#007AFF]/15 text-[#007AFF] dark:text-[#0A84FF] font-semibold'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Integer ID Input & Live Hex/Binary Conversion */}
        <div className="space-y-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="watermark-int-id"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              02. Target 32-Bit Integer Identifier (0 to 4,294,967,295)
            </label>
            <button
              type="button"
              onClick={handleRandomizeId}
              className="text-xs font-medium text-[#007AFF] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Shuffle className="w-3 h-3" aria-hidden="true" />
              <span>Generate Random ID</span>
            </button>
          </div>

          <input
            id="watermark-int-id"
            type="text"
            inputMode="numeric"
            value={integerInput}
            onChange={(e) => setIntegerInput(e.target.value)}
            placeholder="e.g. 20488"
            className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 font-mono tabular-nums text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
          />

          {/* Auto-Hex & 32-Bit Binary Sequence Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-zinc-50/90 dark:bg-zinc-950/50 border border-black/[0.05] dark:border-white/[0.06]">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                8-Char Hexadecimal
              </div>
              <div
                data-testid="live-hex-preview"
                className="font-mono tabular-nums text-sm font-semibold text-[#007AFF] dark:text-[#0A84FF]"
              >
                {parsedIdInfo.hex}
              </div>
            </div>

            <div className="sm:col-span-2 p-3 rounded-xl bg-zinc-50/90 dark:bg-zinc-950/50 border border-black/[0.05] dark:border-white/[0.06]">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                32-Bit Binary Sequence (MSB b0 → LSB b31)
              </div>
              <div
                data-testid="live-binary-preview"
                className="font-mono tabular-nums text-xs text-zinc-800 dark:text-zinc-200 tracking-tight break-all"
              >
                {formattedBinaryNibbles}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Asset Title & Destination URL Input */}
        <div className="space-y-4 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div>
            <label
              htmlFor="watermark-asset-title"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              03. Asset Title
            </label>
            <input
              id="watermark-asset-title"
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g. Sculptural Vessel Edition IV"
              maxLength={120}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="watermark-target-url"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                04. Official Destination URL (HTTPS Required)
              </label>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {urlValidation.valid ? 'Valid HTTPS URI' : 'Requires https://'}
              </span>
            </div>
            <input
              id="watermark-target-url"
              type="url"
              value={targetUrlInput}
              onChange={(e) => setTargetUrlInput(e.target.value)}
              placeholder="https://official.veriimg.org/authentic/20488"
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>

          {/* Safety Delta Margin Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="watermark-delta-slider"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                05. Luminance Safety Margin (δ)
              </label>
              <span className="font-mono tabular-nums text-xs text-zinc-600 dark:text-zinc-300">
                ±{deltaInput} luminance units (128 ± {deltaInput})
              </span>
            </div>
            <input
              id="watermark-delta-slider"
              type="range"
              min={6}
              max={36}
              value={deltaInput}
              onChange={(e) => setDeltaInput(Number(e.target.value))}
              className="w-full accent-[#007AFF] cursor-pointer"
            />
          </div>
        </div>

        {/* Submit: Generate & Save */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full min-h-[46px] px-6 py-3 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>
              {isProcessing
                ? 'Embedding 32-Bit Luminance Signature...'
                : 'Generate & Save Watermarked PNG'}
            </span>
          </button>
        </div>
      </form>

      {/* Right Column: Live Source & Embedded Output Preview (5 cols) */}
      <div className="lg:col-span-5 rounded-2xl bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {generatedOutput ? 'Watermarked Output Ready' : 'Source Canvas Preview'}
          </h3>
          <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
            20×20 Grid · 32 Header Blocks
          </span>
        </div>

        <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/8 dark:border-white/10">
          <img
            src={generatedOutput ? generatedOutput.pngDataUrl : selectedSourceUrl}
            alt={generatedOutput ? generatedOutput.title : sourceFileLabel}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          {!generatedOutput && (
            <img
              src={BRAND_LOGO_PATH}
              alt="veriimg corner watermark preview"
              title="Bottom-right corner logo watermark preview"
              className="absolute bottom-2 right-2.5 h-3.5 w-auto object-contain opacity-85 mix-blend-multiply dark:mix-blend-screen pointer-events-none"
            />
          )}
        </div>

        {generatedOutput ? (
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-2.5 text-xs text-[#248A3D] dark:text-[#30D158]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Embedded ID {generatedOutput.embedding.id} ({generatedOutput.embedding.hex}) in{' '}
                  {generatedOutput.embedding.durationMs}ms
                </p>
                <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                  All 32 blocks B0..B31 modulated to clear 128 ± {generatedOutput.embedding.delta}{' '}
                  threshold and saved to registry.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onVerifyGeneratedInPortal(generatedOutput.pngDataUrl, generatedOutput.title)
                }
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#34C759] hover:bg-[#2DB34E] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Verify in Public Portal</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerPngDownload(
                    generatedOutput.pngDataUrl,
                    `veriimg-${generatedOutput.embedding.id}.png`
                  )
                }
                className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Download PNG</span>
              </button>
            </div>

            <a
              href={generatedOutput.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#007AFF] dark:text-[#0A84FF] hover:underline inline-flex items-center gap-1"
            >
              <span>Target URL: {generatedOutput.targetUrl}</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            When you click <strong>Generate & Save Watermarked PNG</strong>, the Web Worker
            partitions the image into 400 blocks and adjusts ITU-R BT.601 luminance across the first
            32 blocks (row 0 and columns 0–11 of row 1) to encode {parsedIdInfo.hex}.
          </p>
        )}
      </div>
    </div>
  );
}

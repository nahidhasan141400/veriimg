'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Grid,
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  DEFAULT_DELTA,
  LUMINANCE_THRESHOLD,
  intToBinary32,
  intToHex32,
  ExtractionResult,
} from '@/lib/watermark-engine';
import {
  loadImageElement,
  getImageDataFromImage,
  simulateCompressionAndExtract,
} from '@/lib/canvas-utils';
import { runWorkerEmbedding } from '@/lib/worker-client';

const LAB_SAMPLES = [
  { label: 'Glass Art Pavilion', url: '/samples/architecture.jpg', defaultId: 88412 },
  { label: 'Titanium Chronograph', url: '/samples/watch.jpg', defaultId: 10425 },
  { label: 'Ceramic Vessel', url: '/samples/sculpture.jpg', defaultId: 524287 },
];

export function AdminLabTab() {
  const [sampleUrl, setSampleUrl] = useState<string>(LAB_SAMPLES[0].url);
  const [targetId, setTargetId] = useState<number>(LAB_SAMPLES[0].defaultId);
  const [delta, setDelta] = useState<number>(DEFAULT_DELTA);
  const [jpegQuality, setJpegQuality] = useState<number>(88);
  const [resizeScale, setResizeScale] = useState<number>(100);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);

  const [labResult, setLabResult] = useState<{
    previewUrl: string;
    extracted: ExtractionResult;
    embedDurationMs: number;
  } | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const runSandboxCalibration = useCallback(async () => {
    try {
      setIsRunning(true);
      const img = await loadImageElement(sampleUrl);
      const { imageData } = getImageDataFromImage(img, 800);

      const embedded = await runWorkerEmbedding(imageData, targetId, delta);
      const { extracted, compressedPreviewUrl } = await simulateCompressionAndExtract(
        embedded.pixels,
        embedded.width,
        embedded.height,
        jpegQuality,
        resizeScale,
        delta
      );

      setLabResult({
        previewUrl: compressedPreviewUrl,
        extracted,
        embedDurationMs: embedded.durationMs,
      });
    } finally {
      setIsRunning(false);
    }
  }, [sampleUrl, targetId, delta, jpegQuality, resizeScale]);

  useEffect(() => {
    runSandboxCalibration();
  }, [runSandboxCalibration]);

  const expectedBinary = useMemo(() => intToBinary32(targetId), [targetId]);
  const expectedHex = useMemo(() => intToHex32(targetId), [targetId]);

  const recoveryMetrics = useMemo(() => {
    if (!labResult) {
      return { matchedBits: 32, accuracyPercent: 100, exactMatch: true };
    }
    let matched = 0;
    for (let i = 0; i < 32; i++) {
      if (labResult.extracted.binary[i] === expectedBinary[i]) {
        matched++;
      }
    }
    return {
      matchedBits: matched,
      accuracyPercent: Number(((matched / 32) * 100).toFixed(1)),
      exactMatch: labResult.extracted.id === targetId,
    };
  }, [labResult, expectedBinary, targetId]);

  const activeBlock = labResult?.extracted.blocks[selectedBlockIndex] || null;

  return (
    <div className="space-y-8">
      {/* Top Row: 20x20 Grid Matrix Visualizer (7 cols) + Tuning Sandbox Controls (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 20x20 Grid Matrix Visualizer */}
        <div className="lg:col-span-7 rounded-2xl bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                20×20 Spatial Grid Matrix Visualizer
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                400 uniform blocks (Δx = {labResult?.extracted.deltaX || 40}px, Δy ={' '}
                {labResult?.extracted.deltaY || 30}px). Active 32-bit payload occupies B0..B31.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGridOverlay((prev) => !prev)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  showGridOverlay
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <Grid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{showGridOverlay ? 'Hide 20×20 Grid' : 'Show 20×20 Grid'}</span>
              </button>
            </div>
          </div>

          {/* Preset Image Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {LAB_SAMPLES.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => {
                  setSampleUrl(s.url);
                  setTargetId(s.defaultId);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  sampleUrl === s.url
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {s.label} (ID {s.defaultId})
              </button>
            ))}
          </div>

          {/* Image Viewport with Interactive 20x20 Grid Overlay */}
          <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-zinc-950 border border-black/10 dark:border-white/10">
            {labResult && (
              <img
                src={labResult.previewUrl}
                alt="R&D Lab spatial grid inspection preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}

            {showGridOverlay && (
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: 'repeat(20, minmax(0, 1fr))',
                  gridTemplateRows: 'repeat(20, minmax(0, 1fr))',
                }}
              >
                {Array.from({ length: 400 }).map((_, k) => {
                  const isWatermarkBit = k < 32;
                  const blockData = isWatermarkBit ? labResult?.extracted.blocks[k] : undefined;
                  const isSelected = k === selectedBlockIndex;

                  if (!isWatermarkBit) {
                    return (
                      <div
                        key={k}
                        className="border-[0.5px] border-white/15 pointer-events-none"
                      />
                    );
                  }

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedBlockIndex(k)}
                      aria-label={`Inspect block B${k}`}
                      className={`relative border transition-colors flex items-center justify-center text-[9px] font-mono tabular-nums font-bold cursor-pointer ${
                        isSelected
                          ? 'border-white bg-[#007AFF]/70 text-white z-10 ring-2 ring-white'
                          : blockData?.bit === 1
                          ? 'border-[#34C759]/80 bg-[#34C759]/30 text-white hover:bg-[#34C759]/50'
                          : 'border-[#0A84FF]/80 bg-black/55 text-zinc-100 hover:bg-black/75'
                      }`}
                    >
                      {blockData ? blockData.bit : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Block Telemetry Strip */}
          {activeBlock && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Selected Block: </span>
                <span className="font-mono tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                  B{activeBlock.index} (Row {activeBlock.row}, Col {activeBlock.col})
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Bounds: </span>
                <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                  x[{activeBlock.xStart}..{activeBlock.xEnd}), y[{activeBlock.yStart}..
                  {activeBlock.yEnd})
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Avg Luminance Ȳ: </span>
                <span className="font-mono tabular-nums font-bold text-[#007AFF] dark:text-[#0A84FF]">
                  {activeBlock.avgLuminance} / 255
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Decoded Bit: </span>
                <span className="font-mono tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                  b{activeBlock.index} = {activeBlock.bit} (
                  {activeBlock.avgLuminance >= LUMINANCE_THRESHOLD ? '≥ 128' : '< 128'})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tuning Sandbox Controls & Recovery Telemetry (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#007AFF]" aria-hidden="true" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Tuning & Compression Sandbox
              </h3>
            </div>
            <button
              type="button"
              onClick={runSandboxCalibration}
              disabled={isRunning}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Re-Run</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Modulation Delta Margin */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label
                  htmlFor="lab-delta-slider"
                  className="font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Modulation Delta Margin (δ)
                </label>
                <span className="font-mono tabular-nums text-[#007AFF] dark:text-[#0A84FF] font-semibold">
                  ±{delta} (Targets: ≤{128 - delta} / ≥{128 + delta})
                </span>
              </div>
              <input
                id="lab-delta-slider"
                type="range"
                min={2}
                max={42}
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
                className="w-full accent-[#007AFF] cursor-pointer"
              />
            </div>

            {/* Simulated JPEG Lossy Compression Quality */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label
                  htmlFor="lab-jpeg-slider"
                  className="font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Simulated JPEG Compression Quality
                </label>
                <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200 font-semibold">
                  {jpegQuality}% {jpegQuality >= 80 ? '(NFR-ROB-01 Nominal)' : '(Extreme Lossy)'}
                </span>
              </div>
              <input
                id="lab-jpeg-slider"
                type="range"
                min={25}
                max={100}
                value={jpegQuality}
                onChange={(e) => setJpegQuality(Number(e.target.value))}
                className="w-full accent-[#007AFF] cursor-pointer"
              />
            </div>

            {/* Proportional Resize Scale */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label
                  htmlFor="lab-scale-slider"
                  className="font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Proportional Resize Scale (NFR-ROB-02)
                </label>
                <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200 font-semibold">
                  {resizeScale}% ({labResult?.extracted.width || 800}×
                  {labResult?.extracted.height || 600}px)
                </span>
              </div>
              <input
                id="lab-scale-slider"
                type="range"
                min={50}
                max={125}
                step={5}
                value={resizeScale}
                onChange={(e) => setResizeScale(Number(e.target.value))}
                className="w-full accent-[#007AFF] cursor-pointer"
              />
            </div>
          </div>

          {/* Recovery Results Readout */}
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Bit Recovery Rate
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-bold inline-flex items-center gap-1.5 ${
                  recoveryMetrics.exactMatch
                    ? 'text-[#248A3D] dark:text-[#30D158]'
                    : 'text-[#FF3B30]'
                }`}
              >
                {recoveryMetrics.exactMatch ? (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {recoveryMetrics.matchedBits}/32 bits ({recoveryMetrics.accuracyPercent}%)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Embedded Identifier</span>
              <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                {targetId} · {expectedHex}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Extracted Post-JPEG</span>
              <span className="font-mono tabular-nums font-semibold text-[#007AFF] dark:text-[#0A84FF]">
                {labResult ? `${labResult.extracted.id} · ${labResult.extracted.hex}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Worker Processing Latency</span>
              <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                Embed {labResult?.embedDurationMs || 0}ms · Extract{' '}
                {labResult?.extracted.durationMs || 0}ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Block Luminance Inspector (B0 to B31 Heatmap & Threshold Chart) */}
      <div className="rounded-2xl bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Block Luminance Inspector (B0 to B31)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ITU-R BT.601 average brightness Ȳ across all 32 watermark blocks relative to the 50%
              luminance threshold (L = 128). Click any block bar to inspect its coordinates.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className="text-[#248A3D] dark:text-[#30D158]">
              Bit 1: Ȳ ≥ 128 (Target ≥ {128 + delta})
            </span>
            <span className="text-[#007AFF] dark:text-[#0A84FF]">
              Bit 0: Ȳ &lt; 128 (Target &lt; {128 - delta})
            </span>
          </div>
        </div>

        {/* 32-Block Visual Bar & Heatmap Matrix */}
        <div className="grid grid-cols-8 sm:grid-cols-16 lg:grid-cols-32 gap-1.5 pt-2">
          {(labResult?.extracted.blocks || []).map((b) => {
            const heightPct = Math.max(6, Math.min(100, (b.avgLuminance / 255) * 100));
            const isSelected = b.index === selectedBlockIndex;
            return (
              <button
                key={b.index}
                type="button"
                onClick={() => setSelectedBlockIndex(b.index)}
                aria-label={`Block B${b.index} luminance ${b.avgLuminance} bit ${b.bit}`}
                className={`group flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#007AFF] bg-[#007AFF]/10'
                    : 'border-black/[0.05] dark:border-white/[0.06] hover:border-zinc-400'
                }`}
              >
                <span className="text-[10px] font-mono tabular-nums text-zinc-400 mb-1">
                  B{b.index}
                </span>

                <div className="relative w-full h-24 rounded-md bg-zinc-100 dark:bg-zinc-950 overflow-hidden flex items-end">
                  {/* 50% (128) Threshold Reference Line */}
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-zinc-400 dark:border-zinc-500 z-10"
                    style={{ bottom: '50.2%' }}
                  />
                  <div
                    className={`w-full transition-all ${
                      b.bit === 1 ? 'bg-[#34C759]' : 'bg-[#007AFF]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>

                <span className="mt-1.5 text-[10px] font-mono tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                  {b.bit}
                </span>
                <span className="text-[9px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {Math.round(b.avgLuminance)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

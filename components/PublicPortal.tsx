'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ImagePlus,
  UploadCloud,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { WatermarkRecord, lookupWatermarkRecord } from '@/lib/firebase';
import {
  loadImageElement,
  getImageDataFromImage,
  createWatermarkedSampleFromUrl,
} from '@/lib/canvas-utils';
import { runWorkerExtraction } from '@/lib/worker-client';

export type VerificationState =
  | { status: 'idle' }
  | { status: 'scanning'; previewUrl: string; fileName: string }
  | {
      status: 'verified';
      previewUrl: string;
      record: WatermarkRecord;
    }
  | {
      status: 'unverified';
      previewUrl?: string;
      reason?: string;
    };

interface PublicPortalProps {
  records: WatermarkRecord[];
  externalImageToVerify?: { dataUrl: string; title: string } | null;
  onClearExternalImage?: () => void;
  triggerFilePickerSeq?: number;
}

export function PublicPortal({
  records,
  externalImageToVerify,
  onClearExternalImage,
  triggerFilePickerSeq,
}: PublicPortalProps) {
  const [scanState, setScanState] = useState<VerificationState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const verifyImageSource = useCallback(
    async (source: File | string, label: string) => {
      try {
        const img = await loadImageElement(source);
        const { imageData, previewDataUrl } = getImageDataFromImage(img, 1200);

        setScanState({
          status: 'scanning',
          previewUrl: previewDataUrl,
          fileName: label,
        });

        const [extraction] = await Promise.all([
          runWorkerExtraction(imageData),
          new Promise((r) => setTimeout(r, 420)),
        ]);

        const matchedRecord = await lookupWatermarkRecord(extraction.id, records);

        if (matchedRecord) {
          setScanState({
            status: 'verified',
            previewUrl: previewDataUrl,
            record: matchedRecord,
          });
        } else {
          setScanState({
            status: 'unverified',
            previewUrl: previewDataUrl,
          });
        }
      } catch {
        setScanState({
          status: 'unverified',
          reason: 'Unable to read image format. Please choose a valid PNG, JPEG, or WebP image.',
        });
      }
    },
    [records]
  );

  // Trigger verification automatically if Admin Panel passed a newly generated image to test
  React.useEffect(() => {
    if (!externalImageToVerify) return;
    const { dataUrl, title } = externalImageToVerify;
    const timer = window.setTimeout(() => {
      verifyImageSource(dataUrl, title);
      onClearExternalImage?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [externalImageToVerify, verifyImageSource, onClearExternalImage]);

  // Allow consumer header CTA to open file input
  React.useEffect(() => {
    if (!triggerFilePickerSeq) return;
    fileInputRef.current?.click();
  }, [triggerFilePickerSeq]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      verifyImageSource(file, file.name);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      verifyImageSource(file, file.name);
    }
  };

  const handleQuickSampleVerify = async (sampleType: 'watch' | 'architecture' | 'unmarked') => {
    try {
      if (sampleType === 'unmarked') {
        await verifyImageSource('/samples/sculpture.jpg', 'Unmarked Photo Sample');
        return;
      }

      const targetRecord =
        sampleType === 'watch'
          ? records.find((r) => r.id === 10425) || records[0]
          : records.find((r) => r.id === 88412) || records[1] || records[0];

      if (!targetRecord) {
        await verifyImageSource('/samples/sculpture.jpg', 'Sample Image');
        return;
      }

      const sampleUrl =
        targetRecord.sourceSampleUrl ||
        (sampleType === 'watch' ? '/samples/watch.jpg' : '/samples/architecture.jpg');

      setScanState({
        status: 'scanning',
        previewUrl: sampleUrl,
        fileName: targetRecord.title,
      });

      const { pngDataUrl } = await createWatermarkedSampleFromUrl(
        sampleUrl,
        targetRecord.id,
        targetRecord.delta || 14
      );
      await verifyImageSource(pngDataUrl, targetRecord.title);
    } catch {
      setScanState({ status: 'unverified' });
    }
  };

  const handleReset = () => {
    setScanState({ status: 'idle' });
  };

  return (
    <section
      id="verify"
      aria-label="Public Image Verification Portal"
      className="w-full max-w-3xl mx-auto px-4 pt-8 pb-16 sm:pt-14 sm:pb-24"
    >
      {/* Minimalist iOS-inspired Hero Heading (REQ-PUB-01) */}
      <div className="text-center mb-8 sm:mb-10">
        <h1
          className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3"
          style={{ textWrap: 'balance' }}
        >
          Verify your image
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          Drop an image or capture a photo to authenticate its origin and open its official source
          link.
        </p>
      </div>

      {/* Hidden File & Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Upload image file to verify"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Capture photo with camera"
      />

      {/* Main Surface Card */}
      <div className="rounded-3xl bg-white/85 dark:bg-zinc-900/80 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] shadow-sm p-6 sm:p-8 transition-all">
        <AnimatePresence mode="wait">
          {scanState.status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {/* Drag & Drop Zone (REQ-PUB-01 & REQ-PUB-02) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed transition-colors duration-150 p-8 sm:p-12 text-center ${
                  isDragging
                    ? 'border-[#007AFF] bg-[#007AFF]/[0.05]'
                    : 'border-zinc-300/90 dark:border-zinc-700/80 hover:border-[#007AFF]/60 bg-zinc-50/60 dark:bg-zinc-950/40'
                }`}
              >
                <div className="mx-auto w-16 h-16 rounded-2xl bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 flex items-center justify-center text-[#007AFF] dark:text-[#0A84FF] mb-5">
                  {isDragging ? (
                    <UploadCloud className="w-8 h-8" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="w-8 h-8" aria-hidden="true" />
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Choose an image or drag it here
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-7 max-w-sm mx-auto">
                  Supports PNG, JPEG, and WebP formats. Processed locally in your browser.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" aria-hidden="true" />
                    <span>Select Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" aria-hidden="true" />
                    <span>Use Camera</span>
                  </button>
                </div>
              </div>

              {/* Instant Sample Verification Bar */}
              <div
                id="samples"
                className="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.08]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Try instant verification with a sample image:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickSampleVerify('watch')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Verified Watch Sample
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSampleVerify('architecture')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Verified Pavilion Sample
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSampleVerify('unmarked')}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Unverified Photo Sample
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Scanning Animation Overlay State (REQ-PUB-02) */}
          {scanState.status === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-6 text-center"
              role="status"
              aria-live="polite"
            >
              <div className="relative w-full max-w-sm mx-auto aspect-4/3 rounded-2xl overflow-hidden bg-zinc-900 mb-6 border border-black/10 dark:border-white/10">
                <img
                  src={scanState.previewUrl}
                  alt="Scanning uploaded image"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-85"
                />
                <motion.div
                  initial={{ y: '-10%' }}
                  animate={{ y: '110%' }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'linear',
                  }}
                  className="absolute inset-x-0 h-1 bg-[#007AFF] shadow-[0_0_20px_#007AFF]"
                />
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                  <div className="px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-sm font-medium flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-[#0A84FF] animate-pulse" aria-hidden="true" />
                    <span>Scanning image...</span>
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Checking authenticity...
              </p>
            </motion.div>
          )}

          {/* Verification Success State (REQ-PUB-03) */}
          {scanState.status === 'verified' && (
            <motion.div
              key="verified"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="text-center py-1"
              role="region"
              aria-label="Verification Success"
            >
              <div className="w-full max-w-xs mx-auto aspect-4/3 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-4 border border-black/8 dark:border-white/10">
                <img
                  src={scanState.previewUrl || scanState.record.thumbnailDataUrl}
                  alt={scanState.record.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#34C759]/15 text-[#34C759] mb-3"
              >
                <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
              </motion.div>

              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
                This image is verified
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Authenticated origin for{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-200">
                  {scanState.record.title}
                </span>
              </p>

              {/* Official Destination URL Card (REQ-PUB-03) */}
              <a
                href={scanState.record.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block w-full max-w-md mx-auto p-3.5 rounded-2xl bg-zinc-50 hover:bg-[#007AFF]/[0.06] dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-black/8 dark:border-white/10 transition-colors text-left mb-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
                      Official Source Link
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-[#007AFF] dark:text-[#0A84FF] truncate">
                      {scanState.record.targetUrl}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#007AFF] text-white flex items-center justify-center shrink-0 group-hover:bg-[#0066D6] transition-colors">
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>
              </a>

              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Verify Another Image</span>
              </button>
            </motion.div>
          )}

          {/* Verification Failure State (REQ-PUB-04) */}
          {scanState.status === 'unverified' && (
            <motion.div
              key="unverified"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="text-center py-4"
              role="region"
              aria-label="Verification Failed"
            >
              {scanState.previewUrl && (
                <div className="w-full max-w-xs mx-auto aspect-4/3 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-6 border border-black/8 dark:border-white/10 opacity-75">
                  <img
                    src={scanState.previewUrl}
                    alt="Unverified uploaded image"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FF3B30]/15 text-[#FF3B30] mb-4">
                <AlertCircle className="w-8 h-8" aria-hidden="true" />
              </div>

              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                This image could not be verified.
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-7">
                {scanState.reason ||
                  'No registered watermark signature matching an official source record was found in this image.'}
              </p>

              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Try Another Image</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Consumer How It Works Section (No Technical Clutter) */}
      <div
        id="how-it-works"
        className="mt-12 pt-10 border-t border-black/[0.06] dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-6 text-left"
      >
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF]">
            01. Select or Drop
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Upload any digital image
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Choose a photo from your device or capture one directly with your mobile camera.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF]">
            02. Instant Browser Check
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Private client-side scan
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Your image is inspected directly inside your web browser without uploading files to external servers.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF]">
            03. Official Destination
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Open the verified source
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Verified media reveals an authenticity confirmation with a direct link to the publisher&apos;s official page.
          </p>
        </div>
      </div>
    </section>
  );
}

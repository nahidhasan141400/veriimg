'use client';

import React from 'react';
import {
  ExternalLink,
  Mail,
  ArrowLeft,
  ShieldCheck,
  Code2,
  Cpu,
  Lock,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '@/lib/firebase';

export const DEVELOPER_LINKEDIN_URL = 'https://www.linkedin.com/in/nahidhasan141400/';
export const DEVELOPER_GITHUB_URL = 'https://github.com/nahidhasan141400';
export const DEVELOPER_PHOTO_PATH = '/developer.jpeg';

interface DeveloperAboutPageProps {
  onBackToVerify: () => void;
}

export function DeveloperAboutPage({ onBackToVerify }: DeveloperAboutPageProps) {
  return (
    <section
      aria-label="About the Developer"
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-20 sm:pt-12 sm:pb-28 space-y-12"
    >
      {/* Top Breadcrumb / Back Action */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToVerify}
          className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Image Verification</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Developer Profile</span>
          <span aria-hidden="true">·</span>
          <span>veriimg Architecture</span>
        </div>
      </div>

      {/* 2-Column Balanced Hero Split (frontend-design §5.13) */}
      <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left 5 Cols: Developer Portrait (/public/developer.jpeg) */}
          <div className="lg:col-span-5 relative min-h-[280px] sm:min-h-[340px] bg-zinc-950">
            <img
              src={DEVELOPER_PHOTO_PATH}
              alt="Nahid Hasan — Creator and Lead Developer of veriimg"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5">
              <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <span>Nahid Hasan</span>
                <span aria-hidden="true">·</span>
                <span>Lead Software Engineer</span>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Bio, Role, & LinkedIn / Contact Actions */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Unboxed Metadata Kicker (Zero-Pill Discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF]">
                <span>Creator &amp; Lead Architect</span>
                <span aria-hidden="true">·</span>
                <span>Full-Stack Software Engineer</span>
                <span aria-hidden="true">·</span>
                <span>Media Security</span>
              </div>

              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
                style={{ textWrap: 'balance' }}
              >
                Nahid Hasan
              </h1>

              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Full-stack engineer and system architect focused on high-performance web
                applications, client-side visual media authentication, and zero-trust cloud systems.
                Designed and built <strong className="text-zinc-900 dark:text-zinc-100">veriimg</strong> to enable instant, privacy-preserving image verification directly inside the browser without heavy backend compute pipelines.
              </p>

              {/* Key Attributes Row */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/[0.05] dark:border-white/[0.06]">
                  <div className="text-zinc-400 dark:text-zinc-500 mb-0.5">Primary Focus</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Next.js, React, TypeScript &amp; Web Workers
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/[0.05] dark:border-white/[0.06]">
                  <div className="text-zinc-400 dark:text-zinc-500 mb-0.5">System Role</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Founder &amp; Super Admin (veriimg)
                  </div>
                </div>
              </div>
            </div>

            {/* Primary CTA Buttons: LinkedIn Profile + Direct Email */}
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center gap-3">
              <a
                href={DEVELOPER_LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-xs"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
                </svg>
                <span>Connect on LinkedIn</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
              </a>

              <a
                href={`mailto:${SUPER_ADMIN_EMAIL}`}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>{SUPER_ADMIN_EMAIL}</span>
              </a>

              <a
                href={DEVELOPER_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Code2 className="w-4 h-4" aria-hidden="true" />
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Architectural & Engineering Pillars */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Engineering Philosophy &amp; System Architecture
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Core technical principles engineered by Nahid Hasan for the veriimg verification engine
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#007AFF]/12 text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center">
              <Cpu className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              01. 100% Client-Side Signal Processing
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Executes 20×20 spatial grid partitioning and ITU-R BT.601 luminance modulation
              entirely inside background Web Workers and HTML5 Canvas—eliminating server image
              uploads and preserving user privacy.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#34C759]/12 text-[#34C759] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              02. 32-Bit Cryptographic Source Mapping
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Encodes 32-bit unsigned identifiers across header blocks B0 through B31 with
              configurable safety delta margins, linking authentic visual assets directly to
              verified HTTPS publisher destinations.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/12 text-amber-500 flex items-center justify-center">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              03. Zero-Trust Google Admin Governance
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Secures the back-office control plane behind verified Google OAuth and strict
              Firestore security rules, governed by Super Admin allowlisting and real-time R&amp;D
              calibration telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom LinkedIn Reference Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Official LinkedIn Profile
          </div>
          <a
            href={DEVELOPER_LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#007AFF] dark:text-[#0A84FF] hover:underline break-all"
          >
            {DEVELOPER_LINKEDIN_URL}
          </a>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={DEVELOPER_LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>View LinkedIn Profile</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={onBackToVerify}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Verify an Image
          </button>
        </div>
      </div>
    </section>
  );
}

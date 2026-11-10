'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DeveloperAboutPage } from '@/components/DeveloperAboutPage';
import { BRAND_LOGO_PATH } from '@/lib/canvas-utils';

export default function AboutDeveloperRoute() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] dark:bg-[#09090B]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08]">
        <a
          href="/"
          aria-label="veriimg Home"
          className="inline-flex items-center whitespace-nowrap shrink-0"
        >
          <img
            src={BRAND_LOGO_PATH}
            alt="veriimg"
            className="h-8 sm:h-9 w-auto object-contain rounded-md"
          />
        </a>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          <a
            href="/"
            className="hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Verify Image
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://www.linkedin.com/in/nahidhasan141400/"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <span>LinkedIn Profile</span>
          </a>
        </div>
      </header>

      <main className="flex-1 w-full">
        <DeveloperAboutPage onBackToVerify={() => router.push('/')} />
      </main>
    </div>
  );
}

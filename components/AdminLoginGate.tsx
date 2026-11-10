'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '@/lib/firebase';
import { BRAND_LOGO_PATH } from '@/lib/canvas-utils';

interface AdminLoginGateProps {
  onGoogleLogin: () => Promise<void>;
  onBackToPublic: () => void;
  authError: string | null;
  unauthorizedEmail: string | null;
  loggedOutNotice?: boolean;
}

export function AdminLoginGate({
  onGoogleLogin,
  onBackToPublic,
  authError,
  unauthorizedEmail,
  loggedOutNotice,
}: AdminLoginGateProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleGoogleClick = async () => {
    try {
      setIsSubmitting(true);
      await onGoogleLogin();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F5F5F7] dark:bg-[#09090B] px-4 py-8">
      {/* Minimal Top Return Bar with Brand Logo */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToPublic}
          className="inline-flex items-center gap-2 cursor-pointer"
        >
          <img
            src={BRAND_LOGO_PATH}
            alt="veriimg"
            className="h-8 sm:h-9 w-auto object-contain rounded-md"
          />
        </button>
        <button
          type="button"
          onClick={onBackToPublic}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Public Verification</span>
        </button>
      </div>

      {/* Centered Google-Only Authentication Card */}
      <section
        aria-label="Administrator Login"
        className="w-full max-w-md mx-auto my-auto py-8"
      >
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-black/[0.07] dark:border-white/[0.08] shadow-xs p-7 sm:p-9 space-y-6">
          {/* Header with Veriimg Logo */}
          <div className="text-center space-y-3">
            <div className="mx-auto inline-flex items-center justify-center px-3.5 py-2 rounded-2xl bg-white border border-black/[0.06]">
              <img
                src={BRAND_LOGO_PATH}
                alt="veriimg Secure Image Logo"
                className="h-9 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Admin Console Sign In
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Sign in with your authorized Google account to access the watermark registry, R&amp;D
              calibration lab, and administrator directory.
            </p>
          </div>

          {/* Logged Out Confirmation Banner */}
          {loggedOutNotice && !authError && !unauthorizedEmail && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-[#34C759]/12 border border-[#34C759]/30 text-[#248A3D] dark:text-[#30D158] text-xs font-medium flex items-center gap-2.5"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>You have been securely logged out of the Admin Console.</span>
            </div>
          )}

          {/* Unauthorized Google Account Access Denied Alert */}
          {unauthorizedEmail && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Access Denied — Unauthorized Google Account</span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                The account <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{unauthorizedEmail}</span> is not on the administrator allowlist and has been signed out immediately. Only Super Admin (<span className="font-mono">{SUPER_ADMIN_EMAIL}</span>) and explicitly authorized Google accounts can sign in.
              </p>
            </div>
          )}

          {/* General Auth Error Banner */}
          {authError && !unauthorizedEmail && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs font-medium flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          {/* Single Google OAuth Button */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleClick}
              className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>{isSubmitting ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>
          </div>

          {/* Allowlist Governance Footnote */}
          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Super Admin</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">{SUPER_ADMIN_EMAIL}</span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Access is strictly enforced via Google OAuth. Additional administrators must be
              authorized by the Super Admin inside the Admin Manager.
            </p>
          </div>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onBackToPublic}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Return to Public Verification Portal</span>
            </button>
          </div>
        </div>
      </section>

      <div className="w-full max-w-5xl mx-auto text-center text-xs text-zinc-400 dark:text-zinc-500">
        veriimg · Zero-Trust Google Administrator Authentication
      </div>
    </div>
  );
}

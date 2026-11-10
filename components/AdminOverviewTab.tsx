'use client';

import React from 'react';
import {
  Database,
  Users,
  PlusCircle,
  FlaskConical,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { WatermarkRecord, AdminRecord, SUPER_ADMIN_EMAIL } from '@/lib/firebase';

interface AdminOverviewTabProps {
  records: WatermarkRecord[];
  admins: AdminRecord[];
  activeAdminEmail: string;
  activeAdminRole: 'super_admin' | 'admin';
  onNavigateTab: (tab: 'inventory' | 'create' | 'lab' | 'admins') => void;
  onVerifyRecordInPortal: (dataUrl: string, title: string) => void;
}

export function AdminOverviewTab({
  records,
  admins,
  activeAdminEmail,
  activeAdminRole,
  onNavigateTab,
  onVerifyRecordInPortal,
}: AdminOverviewTabProps) {
  const totalAssets = records.length;
  const totalAdmins = 1 + admins.length; // 1 Super Admin + N Delegated Admins
  const meanDelta =
    records.length > 0
      ? (records.reduce((acc, r) => acc + (r.delta || 14), 0) / records.length).toFixed(1)
      : '14.0';

  const recentRecords = records.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Summary Strip (3_saas_dashboard.md §2.B) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            <span>Registered Watermarks</span>
            <Database className="w-4 h-4 text-[#007AFF]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono tabular-nums">
            {totalAssets}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span>Active in registry</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="text-[#007AFF] dark:text-[#0A84FF] hover:underline font-medium cursor-pointer"
            >
              View inventory
            </button>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            <span>Authorized Administrators</span>
            <Users className="w-4 h-4 text-[#34C759]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono tabular-nums">
            {totalAdmins}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span>1 Super Admin</span>
            <span aria-hidden="true">·</span>
            <span>{admins.length} Delegated</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            <span>Mean Luminance Delta</span>
            <Sliders className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono tabular-nums">
            ±{meanDelta} Y
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span>ITU-R BT.601 luma</span>
            <span aria-hidden="true">·</span>
            <span>20×20 grid</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            <span>Current Session Role</span>
            <ShieldCheck className="w-4 h-4 text-[#34C759]" aria-hidden="true" />
          </div>
          <div className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            {activeAdminRole === 'super_admin' ? 'Super Admin' : 'Delegated Admin'}
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
            {activeAdminEmail || SUPER_ADMIN_EMAIL}
          </div>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('create')}
          className="group p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] hover:border-[#007AFF]/50 text-left transition-colors cursor-pointer flex items-start justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <PlusCircle className="w-4 h-4 text-[#007AFF]" aria-hidden="true" />
              <span>Embed New Watermark</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Encode a 32-bit integer signature into a source image and register its destination URL.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#007AFF] shrink-0 mt-0.5 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('admins')}
          className="group p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] hover:border-[#007AFF]/50 text-left transition-colors cursor-pointer flex items-start justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Users className="w-4 h-4 text-[#34C759]" aria-hidden="true" />
              <span>Admin Manager</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {activeAdminRole === 'super_admin'
                ? 'Authorize new Google accounts or revoke delegated administrator access.'
                : 'Inspect the allowlist of Google accounts authorized by the Super Admin.'}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#007AFF] shrink-0 mt-0.5 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('lab')}
          className="group p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] hover:border-[#007AFF]/50 text-left transition-colors cursor-pointer flex items-start justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <FlaskConical className="w-4 h-4 text-amber-500" aria-hidden="true" />
              <span>R&amp;D Calibration Lab</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Inspect 20×20 spatial grid cells, differential block margins, and luma shifts.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#007AFF] shrink-0 mt-0.5 transition-colors" />
        </button>
      </div>

      {/* Recent Watermark Registrations Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Recent Watermark Registrations
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Latest authenticated visual assets mapped to official destination URLs
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            View All ({records.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50/60 dark:bg-zinc-950/40">
                <th className="py-3 px-5">Asset</th>
                <th className="py-3 px-4">Integer ID</th>
                <th className="py-3 px-4">Hex Code</th>
                <th className="py-3 px-4">Destination URL</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] text-sm">
              {recentRecords.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={record.thumbnailDataUrl}
                        alt={record.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-8 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 border border-black/8 dark:border-white/10 shrink-0"
                      />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">
                        {record.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {record.id}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#007AFF] dark:text-[#0A84FF]">
                    {record.hex}
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-400 max-w-[240px] truncate">
                    {record.targetUrl}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const { createWatermarkedSampleFromUrl } = await import(
                            '@/lib/canvas-utils'
                          );
                          const src = record.sourceSampleUrl || record.thumbnailDataUrl;
                          const { pngDataUrl } = await createWatermarkedSampleFromUrl(
                            src,
                            record.id,
                            record.delta || 14
                          );
                          onVerifyRecordInPortal(pngDataUrl, record.title);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#34C759]/12 hover:bg-[#34C759]/20 text-[#248A3D] dark:text-[#30D158] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Verify</span>
                      </button>
                      <a
                        href={record.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open destination URL for ${record.title}`}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

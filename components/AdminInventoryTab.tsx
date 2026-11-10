'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Download,
  Trash2,
  ArrowUpDown,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { WatermarkRecord } from '@/lib/firebase';
import {
  createWatermarkedSampleFromUrl,
  triggerPngDownload,
} from '@/lib/canvas-utils';

interface AdminInventoryTabProps {
  records: WatermarkRecord[];
  onDeleteRecord: (id: number) => Promise<void>;
  onVerifyRecordInPortal: (dataUrl: string, title: string) => void;
  onNavigateToCreate: () => void;
}

type SortField = 'createdAtIso' | 'id' | 'title';

export function AdminInventoryTab({
  records,
  onDeleteRecord,
  onVerifyRecordInPortal,
  onNavigateToCreate,
}: AdminInventoryTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAtIso');
  const [sortAsc, setSortAsc] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = records.filter((item) => {
      if (!q) return true;
      return (
        String(item.id).includes(q) ||
        item.hex.toLowerCase().includes(q) ||
        item.targetUrl.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') {
        cmp = a.id - b.id;
      } else if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else {
        cmp = a.createdAtIso.localeCompare(b.createdAtIso);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [records, searchQuery, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'id');
    }
  };

  const handleDownloadWatermarked = async (record: WatermarkRecord) => {
    try {
      setBusyId(record.id);
      const srcUrl = record.sourceSampleUrl || record.thumbnailDataUrl || '/samples/watch.jpg';
      const { pngDataUrl } = await createWatermarkedSampleFromUrl(
        srcUrl,
        record.id,
        record.delta || 14
      );
      triggerPngDownload(pngDataUrl, `veriimg-${record.id}-${record.hex}.png`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTestVerify = async (record: WatermarkRecord) => {
    try {
      setBusyId(record.id);
      const srcUrl = record.sourceSampleUrl || record.thumbnailDataUrl || '/samples/watch.jpg';
      const { pngDataUrl } = await createWatermarkedSampleFromUrl(
        srcUrl,
        record.id,
        record.delta || 14
      );
      onVerifyRecordInPortal(pngDataUrl, record.title);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar: Search + Sort Controls + Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by integer ID, hex code, title, or URL..."
            aria-label="Search registered watermark assets"
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            {filteredAndSorted.length} of {records.length} registered assets
          </span>
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Watermark Asset</span>
          </button>
        </div>
      </div>

      {/* Registry Table Surface (Section 3.2.1) */}
      <div className="rounded-2xl bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] overflow-hidden">
        {filteredAndSorted.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              No matching watermark records found
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {searchQuery
                ? 'Try clearing your search query or searching by base-10 integer ID.'
                : 'Embed your first 32-bit watermark identifier in the Creation Studio.'}
            </p>
            <button
              type="button"
              onClick={onNavigateToCreate}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create First Watermark</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50/70 dark:bg-zinc-950/40">
                  <th className="py-3.5 pl-5 pr-3">Asset</th>
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('id')}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer whitespace-nowrap"
                    >
                      <span>Integer ID</span>
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Hex Code</th>
                  <th className="py-3.5 px-3">Target URL</th>
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('createdAtIso')}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer whitespace-nowrap"
                    >
                      <span>Created</span>
                      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] text-sm">
                {filteredAndSorted.map((record) => {
                  const formattedDate = new Date(record.createdAtIso).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                  });
                  const isBusy = busyId === record.id;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Thumbnail & Title */}
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-9 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/8 dark:border-white/10 shrink-0">
                            <img
                              src={record.thumbnailDataUrl}
                              alt={record.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                            {record.title}
                          </span>
                        </div>
                      </td>

                      {/* Integer ID */}
                      <td className="py-3 px-3 font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        {record.id}
                      </td>

                      {/* Hex Code */}
                      <td className="py-3 px-3 font-mono tabular-nums text-xs text-[#007AFF] dark:text-[#0A84FF] whitespace-nowrap">
                        {record.hex}
                      </td>

                      {/* Target URL */}
                      <td className="py-3 px-3 max-w-[260px]">
                        <a
                          href={record.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 dark:text-zinc-300 hover:text-[#007AFF] dark:hover:text-[#0A84FF] truncate block transition-colors"
                        >
                          {record.targetUrl}
                        </a>
                      </td>

                      {/* Creation Date */}
                      <td className="py-3 px-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleTestVerify(record)}
                            title={`Test verification for ID ${record.id}`}
                            aria-label={`Verify asset ${record.id} in portal`}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#34C759]/12 hover:bg-[#34C759]/20 text-[#248A3D] dark:text-[#30D158] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verify</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDownloadWatermarked(record)}
                            title={`Download watermarked PNG for ID ${record.id}`}
                            aria-label={`Download watermarked PNG for asset ${record.id}`}
                            className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <a
                            href={record.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Visit ${record.targetUrl}`}
                            aria-label={`Visit destination URL for asset ${record.id}`}
                            className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 inline-flex items-center justify-center transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </a>

                          <button
                            type="button"
                            onClick={() => onDeleteRecord(record.id)}
                            title={`Remove asset ${record.id}`}
                            aria-label={`Delete asset ${record.id}`}
                            className="w-8 h-8 rounded-lg hover:bg-[#FF3B30]/15 text-zinc-500 hover:text-[#FF3B30] inline-flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

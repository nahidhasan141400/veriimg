'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Search,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  AdminRecord,
  SUPER_ADMIN_EMAIL,
  ADMIN_EMAIL_REGEX,
  MAX_ADMIN_DISPLAY_NAME_LENGTH,
} from '@/lib/firebase';

interface AdminManagerTabProps {
  admins: AdminRecord[];
  activeAdminEmail: string;
  activeAdminRole: 'super_admin' | 'admin';
  onAuthorizeAdmin: (params: { email: string; displayName: string }) => Promise<void>;
  onRevokeAdmin: (email: string) => Promise<void>;
}

export function AdminManagerTab({
  admins,
  activeAdminEmail,
  activeAdminRole,
  onAuthorizeAdmin,
  onRevokeAdmin,
}: AdminManagerTabProps) {
  const [newEmail, setNewEmail] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isSuperAdmin =
    activeAdminRole === 'super_admin' ||
    activeAdminEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  const filteredAdmins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q) ||
        a.addedBy.toLowerCase().includes(q)
    );
  }, [admins, searchQuery]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSuperAdmin) {
      setErrorMsg('Only the Super Admin (nahid.main.ai@gmail.com) can authorize administrators.');
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail || !ADMIN_EMAIL_REGEX.test(normalizedEmail)) {
      setErrorMsg('Please enter a valid Google email address (e.g., user@gmail.com).');
      return;
    }

    if (normalizedEmail === SUPER_ADMIN_EMAIL) {
      setErrorMsg(`${SUPER_ADMIN_EMAIL} is already the permanent Super Admin.`);
      return;
    }

    if (admins.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      setErrorMsg(`${normalizedEmail} is already on the authorized administrator allowlist.`);
      return;
    }

    const safeName = (
      newDisplayName.trim() || normalizedEmail.split('@')[0]
    ).slice(0, MAX_ADMIN_DISPLAY_NAME_LENGTH);

    try {
      setIsSubmitting(true);
      await onAuthorizeAdmin({
        email: normalizedEmail,
        displayName: safeName,
      });
      setNewEmail('');
      setNewDisplayName('');
      setSuccessMsg(`Authorized ${normalizedEmail} to sign in with Google as an administrator.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to authorize administrator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (email: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!isSuperAdmin) return;
    try {
      await onRevokeAdmin(email);
      setSuccessMsg(`Revoked administrator access for ${email}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to revoke administrator.');
    }
  };

  const formatShortDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Governance Card & Add Admin Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Super Admin Identity & Policy */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF] mb-1">
                Root Authority · Super Admin
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Primary Owner Account
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#007AFF]/12 text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/[0.06] dark:border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Super Admin Email</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {SUPER_ADMIN_EMAIL}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Authentication</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                Google OAuth (Verified)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Permission Scope</span>
              <span className="text-[#248A3D] dark:text-[#30D158] font-semibold">
                Full Registry &amp; Admin Allowlist
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Only Google accounts listed in this directory can sign in to the Admin Console. Any
            other Google account is automatically rejected and signed out upon login.
          </p>
        </div>

        {/* Right 7 Cols: Authorize New Administrator Form (Super Admin Only) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Authorize Google Administrator
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Grant a colleague permission to sign in with Google and manage watermarked assets.
              </p>
            </div>
            <UserPlus className="w-5 h-5 text-[#007AFF] shrink-0" aria-hidden="true" />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-[#34C759]/12 border border-[#34C759]/30 text-[#248A3D] dark:text-[#30D158] text-xs font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          {isSuperAdmin ? (
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="new-admin-email"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Google Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="new-admin-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="colleague@gmail.com"
                      required
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-admin-name"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Administrator Name / Note
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="new-admin-name"
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="e.g., Jordan Lee (Brand Security)"
                      maxLength={MAX_ADMIN_DISPLAY_NAME_LENGTH}
                      className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Authorizing...' : 'Allow Google User'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Lock className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
              <span>
                You are signed in as a Delegated Administrator (
                <span className="font-mono">{activeAdminEmail}</span>). Only Super Admin (
                <span className="font-mono">{SUPER_ADMIN_EMAIL}</span>) can add or revoke
                administrator accounts.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Authorized Administrators Directory Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
        <div className="p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Allowed Google Administrators ({1 + admins.length})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Complete directory of Google accounts permitted to sign in to the Admin Console
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search admin email or name..."
              aria-label="Search allowed administrators"
              className="w-full min-h-[38px] pl-9 pr-3.5 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50/60 dark:bg-zinc-950/40">
                <th className="py-3 px-5">Administrator</th>
                <th className="py-3 px-4">Google Email</th>
                <th className="py-3 px-4">Role Level</th>
                <th className="py-3 px-4">Authorized By</th>
                <th className="py-3 px-4">Added Date</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] text-sm">
              {/* Permanent Pinned Super Admin Row */}
              <tr className="bg-[#007AFF]/[0.03] dark:bg-[#0A84FF]/[0.05]">
                <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-zinc-50">
                  Nahid (Super Admin)
                </td>
                <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#007AFF] dark:text-[#0A84FF]">
                  {SUPER_ADMIN_EMAIL}
                </td>
                <td className="py-3.5 px-4 text-xs font-semibold text-[#248A3D] dark:text-[#30D158]">
                  Super Admin
                </td>
                <td className="py-3.5 px-4 text-xs text-zinc-500 dark:text-zinc-400">
                  System Root
                </td>
                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                  Permanent
                </td>
                <td className="py-3.5 px-5 text-right text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Protected Owner
                </td>
              </tr>

              {/* Delegated Admin Rows */}
              {filteredAdmins.map((admin) => (
                <tr
                  key={admin.email}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3.5 px-5 font-medium text-zinc-900 dark:text-zinc-100">
                    {admin.displayName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {admin.email}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-300">
                    Delegated Admin
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {admin.addedBy}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                    {formatShortDate(admin.createdAtIso)}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {isSuperAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleRevoke(admin.email)}
                        aria-label={`Revoke access for ${admin.email}`}
                        className="px-3 py-1.5 rounded-lg bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Revoke</span>
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">View Only</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredAdmins.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    No delegated administrators match your search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '@/hooks/useAuth';
import type { SyncStatus } from '@/types/khata';

interface NavbarProps {
  syncStatus: SyncStatus;
  pendingCount: number;
  onSyncClick: () => void;
  onProfileClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  syncStatus,
  pendingCount,
  onSyncClick,
  onProfileClick,
}) => {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
      {/* Brand on mobile / breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="flex md:hidden items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-800 flex items-center justify-center">
            <img src="/icon.svg" alt="KHATA" className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white tracking-tight text-lg">
            KHATA
          </span>
        </div>
        <span className="hidden md:inline-block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Financial Expense Ledger
        </span>
      </div>

      {/* Right Controls: Sync badge, PWA button, Profile */}
      <div className="flex items-center gap-2.5">
        <OfflineIndicator
          syncStatus={syncStatus}
          pendingCount={pendingCount}
          onSyncClick={onSyncClick}
        />

        <div className="hidden sm:block">
          <PWAInstallButton variant="nav" />
        </div>

        <button
          onClick={onProfileClick}
          className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-emerald-500/20 hover:ring-emerald-500/50 transition cursor-pointer"
          title="Account Profile & Settings"
        >
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            (profile?.name || 'U').charAt(0).toUpperCase()
          )}
        </button>
      </div>
    </header>
  );
};

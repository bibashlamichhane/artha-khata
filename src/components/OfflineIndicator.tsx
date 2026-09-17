import React from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import type { SyncStatus } from '@/types/khata';

interface OfflineIndicatorProps {
  syncStatus?: SyncStatus;
  pendingCount?: number;
  onSyncClick?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  syncStatus = 'synced',
  pendingCount = 0,
  onSyncClick,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offline Mode</span>
        </div>
      )}

      {/* Sync Status Pill */}
      {syncStatus === 'syncing' && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing...</span>
        </div>
      )}

      {syncStatus === 'pending' && pendingCount > 0 && (
        <button
          onClick={onSyncClick}
          title="Click to trigger manual sync"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{pendingCount} Pending Sync</span>
        </button>
      )}

      {isOnline && syncStatus === 'synced' && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          <span>Cloud Synced</span>
        </div>
      )}
    </div>
  );
};

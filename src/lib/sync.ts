import { supabase, isSupabaseConfigured } from './supabase';
import {
  idbGetSyncQueue,
  idbRemoveFromSyncQueue,
  idbSaveGroup,
  idbSaveMember,
  idbSaveTransaction,
  idbGetGroups,
  idbGetMembers,
  idbGetTransactions,
  idbSaveProfile,
  idbSaveSettings,
} from './indexeddb';
import type { SyncStatus } from '@/types/khata';

type SyncListener = (status: SyncStatus, pendingCount: number) => void;
const listeners = new Set<SyncListener>();

let currentSyncStatus: SyncStatus = 'synced';
let isSyncing = false;

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  // Initial fire
  idbGetSyncQueue().then((queue) => listener(currentSyncStatus, queue.length));
  return () => listeners.delete(listener);
}

function notifySyncListeners(status: SyncStatus, count: number) {
  currentSyncStatus = status;
  listeners.forEach((l) => l(status, count));
}

/**
 * Synchronizes any pending items in IndexedDB sync queue to Supabase,
 * and fetches the latest updates from Supabase into IndexedDB.
 */
export async function runFullSync(userId?: string): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (!navigator.onLine || !isSupabaseConfigured || isSyncing) {
    const queue = await idbGetSyncQueue();
    notifySyncListeners(navigator.onLine ? 'pending' : 'synced', queue.length);
    return { success: false, syncedCount: 0, error: 'Offline or sync in progress' };
  }

  isSyncing = true;
  notifySyncListeners('syncing', 0);

  let processedCount = 0;

  try {
    // 1. Process outgoing sync queue items first
    const queue = await idbGetSyncQueue();
    notifySyncListeners('syncing', queue.length);

    for (const item of queue) {
      try {
        if (item.action === 'insert') {
          const { error } = await supabase.from(item.table).upsert(item.payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.id);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.id);
          if (error) throw error;
        }
        await idbRemoveFromSyncQueue(item.id);
        processedCount++;
      } catch (err: any) {
        console.warn(`[Sync] Failed to sync item ${item.id} on table ${item.table}:`, err.message);
        // Continue with other queue items to avoid getting stuck on a single failure
      }
    }

    // 2. Fetch latest data from Supabase for this user (if authenticated)
    if (userId) {
      // Profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) await idbSaveProfile(profile);

      // Settings
      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
      if (settings) await idbSaveSettings(settings);

      // Groups
      const { data: groups } = await supabase.from('groups').select('*').eq('owner_id', userId);
      if (groups) {
        for (const g of groups) {
          await idbSaveGroup({ ...g, sync_status: 'synced' });
        }
      }

      // Group Members
      const groupIds = (groups || []).map((g) => g.id);
      if (groupIds.length > 0) {
        const { data: members } = await supabase.from('group_members').select('*').in('group_id', groupIds);
        if (members) {
          for (const m of members) {
            await idbSaveMember({ ...m, sync_status: 'synced' });
          }
        }

        // Transactions with splits
        const { data: transactions } = await supabase
          .from('transactions')
          .select('*, splits:transaction_splits(*)')
          .in('group_id', groupIds);

        if (transactions) {
          for (const t of transactions) {
            const splits = t.splits || [];
            await idbSaveTransaction({ ...t, sync_status: 'synced' }, splits);
          }
        }
      }
    }

    const remainingQueue = await idbGetSyncQueue();
    notifySyncListeners(remainingQueue.length > 0 ? 'pending' : 'synced', remainingQueue.length);
    return { success: true, syncedCount: processedCount };
  } catch (error: any) {
    console.error('[Sync Error]:', error);
    const remainingQueue = await idbGetSyncQueue();
    notifySyncListeners('failed', remainingQueue.length);
    return { success: false, syncedCount: processedCount, error: error.message };
  } finally {
    isSyncing = false;
  }
}

// Auto-sync listener when browser reconnects to the network
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    runFullSync();
  });
}

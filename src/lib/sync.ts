import { supabase, isSupabaseConfigured } from './supabase';
import {
  idbGetSyncQueue,
  idbRemoveFromSyncQueue,
  idbSaveGroup,
  idbDeleteGroup,
  idbSaveMember,
  idbDeleteMember,
  idbSaveTransaction,
  idbDeleteTransaction,
  idbGetGroups,
  idbGetMembers,
  idbGetTransactions,
  idbSaveProfile,
  idbSaveSettings,
  idbGetTombstones,
  idbAddTombstone,
} from './indexeddb';
import type { SyncStatus } from '@/types/khata';

type SyncListener = (status: SyncStatus, pendingCount: number) => void;
const syncStatusListeners = new Set<SyncListener>();

type DataChangeListener = () => void;
const dataChangeListeners = new Set<DataChangeListener>();

let currentSyncStatus: SyncStatus = 'synced';
let isSyncing = false;
let queuedSyncUserId: string | null = null;

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncStatusListeners.add(listener);
  // Initial fire
  idbGetSyncQueue().then((queue) => listener(currentSyncStatus, queue.length));
  return () => syncStatusListeners.delete(listener);
}

export function subscribeDataChange(listener: DataChangeListener): () => void {
  dataChangeListeners.add(listener);
  return () => dataChangeListeners.delete(listener);
}

function notifySyncListeners(status: SyncStatus, count: number) {
  currentSyncStatus = status;
  syncStatusListeners.forEach((l) => l(status, count));
}

function notifyDataChange() {
  dataChangeListeners.forEach((l) => l());
}

/**
 * Synchronizes any pending items in IndexedDB sync queue to Supabase,
 * and fetches/reconciles the latest updates and DELETIONS from Supabase into IndexedDB.
 */
export async function runFullSync(
  userId?: string
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (!navigator.onLine || !isSupabaseConfigured) {
    const queue = await idbGetSyncQueue();
    notifySyncListeners(navigator.onLine ? 'pending' : 'synced', queue.length);
    return { success: false, syncedCount: 0, error: 'Offline or Supabase not configured' };
  }

  // Mutex lock to prevent race conditions during sync
  if (isSyncing) {
    if (userId) queuedSyncUserId = userId;
    return { success: true, syncedCount: 0 };
  }

  isSyncing = true;
  notifySyncListeners('syncing', 0);

  let processedCount = 0;
  let hasLocalDataChanged = false;

  try {
    // Fetch local tombstones
    const tombstones = await idbGetTombstones();
    const tombstonedIds = new Set(tombstones.map((t) => t.id));

    // 1. Process outgoing sync queue items first (FIFO)
    const queue = await idbGetSyncQueue();
    notifySyncListeners('syncing', queue.length);

    for (const item of queue) {
      try {
        if (item.action === 'delete') {
          if (item.table === 'transactions') {
            // Delete splits first to maintain referential integrity
            await supabase.from('transaction_splits').delete().eq('transaction_id', item.id);
            const { error } = await supabase.from('transactions').delete().eq('id', item.id);
            if (error && error.code !== 'PGRST116') throw error;
          } else if (item.table === 'groups') {
            const { error } = await supabase.from('groups').delete().eq('id', item.id);
            if (error && error.code !== 'PGRST116') throw error;
          } else if (item.table === 'group_members') {
            const { error } = await supabase.from('group_members').delete().eq('id', item.id);
            if (error && error.code !== 'PGRST116') throw error;
          } else {
            const { error } = await supabase.from(item.table).delete().eq('id', item.id);
            if (error && error.code !== 'PGRST116') throw error;
          }
          await idbRemoveFromSyncQueue(item.id);
          processedCount++;
        } else {
          // If the item was subsequently tombstoned (deleted locally), do NOT push insert/update
          if (tombstonedIds.has(item.id)) {
            await idbRemoveFromSyncQueue(item.id);
            processedCount++;
            continue;
          }

          if (item.action === 'insert') {
            const { error } = await supabase.from(item.table).upsert(item.payload);
            if (error) throw error;
          } else if (item.action === 'update') {
            const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.id);
            if (error) throw error;
          }

          await idbRemoveFromSyncQueue(item.id);
          processedCount++;
        }
      } catch (err: any) {
        console.warn(`[Sync] Queue item failed (${item.table}:${item.id}):`, err.message);
      }
    }

    // 2. Fetch latest remote data from Supabase & Reconcile Remote Deletions
    if (userId) {
      // Re-read sync queue to see what is currently pending insert/delete
      const updatedQueue = await idbGetSyncQueue();
      const pendingGroupInserts = new Set(
        updatedQueue.filter((q) => q.table === 'groups' && q.action === 'insert').map((q) => q.id)
      );
      const pendingGroupDeletes = new Set(
        updatedQueue.filter((q) => q.table === 'groups' && q.action === 'delete').map((q) => q.id)
      );

      const pendingMemberInserts = new Set(
        updatedQueue.filter((q) => q.table === 'group_members' && q.action === 'insert').map((q) => q.id)
      );
      const pendingMemberDeletes = new Set(
        updatedQueue.filter((q) => q.table === 'group_members' && q.action === 'delete').map((q) => q.id)
      );

      const pendingTxInserts = new Set(
        updatedQueue.filter((q) => q.table === 'transactions' && q.action === 'insert').map((q) => q.id)
      );
      const pendingTxDeletes = new Set(
        updatedQueue.filter((q) => q.table === 'transactions' && q.action === 'delete').map((q) => q.id)
      );

      // 2a. Profile & Settings
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) await idbSaveProfile(profile);

      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', userId).single();
      if (settings) await idbSaveSettings(settings);

      // 2b. Groups Reconciliation
      const { data: remoteGroups } = await supabase.from('groups').select('*').eq('owner_id', userId);
      const localGroups = await idbGetGroups(userId);
      const remoteGroupMap = new Map((remoteGroups || []).map((g) => [g.id, g]));

      // Detect groups deleted remotely on another device
      for (const lg of localGroups) {
        if (!remoteGroupMap.has(lg.id) && !pendingGroupInserts.has(lg.id)) {
          // Deleted remotely!
          await idbDeleteGroup(lg.id);
          await idbAddTombstone(lg.id, 'groups');
          hasLocalDataChanged = true;
        }
      }

      // Save/update remote groups that are not tombstoned or pending deletion
      if (remoteGroups) {
        for (const rg of remoteGroups) {
          if (!tombstonedIds.has(rg.id) && !pendingGroupDeletes.has(rg.id)) {
            await idbSaveGroup({ ...rg, sync_status: 'synced' });
          }
        }
      }

      // 2c. Group Members Reconciliation
      const activeGroups = await idbGetGroups(userId);
      const activeGroupIds = activeGroups.map((g) => g.id);

      if (activeGroupIds.length > 0) {
        const { data: remoteMembers } = await supabase
          .from('group_members')
          .select('*')
          .in('group_id', activeGroupIds);

        const localMembers = await idbGetMembers();
        const activeGroupSet = new Set(activeGroupIds);
        const relevantLocalMembers = localMembers.filter((m) => activeGroupSet.has(m.group_id));
        const remoteMemberMap = new Map((remoteMembers || []).map((m) => [m.id, m]));

        // Detect members deleted remotely
        for (const lm of relevantLocalMembers) {
          if (!remoteMemberMap.has(lm.id) && !pendingMemberInserts.has(lm.id)) {
            await idbDeleteMember(lm.id);
            await idbAddTombstone(lm.id, 'group_members');
            hasLocalDataChanged = true;
          }
        }

        // Save remote members
        if (remoteMembers) {
          for (const rm of remoteMembers) {
            if (!tombstonedIds.has(rm.id) && !pendingMemberDeletes.has(rm.id)) {
              await idbSaveMember({ ...rm, sync_status: 'synced' });
            }
          }
        }

        // 2d. Transactions Reconciliation (CRITICAL CROSS-DEVICE DELETION FIX)
        const { data: remoteTransactions } = await supabase
          .from('transactions')
          .select('*, splits:transaction_splits(*)')
          .in('group_id', activeGroupIds);

        const localTransactions = await idbGetTransactions();
        const relevantLocalTxs = localTransactions.filter((t) => activeGroupSet.has(t.group_id));
        const remoteTxMap = new Map((remoteTransactions || []).map((t) => [t.id, t]));

        // Detect transactions deleted on another device (Device A -> Supabase -> Device B)
        for (const lt of relevantLocalTxs) {
          if (!remoteTxMap.has(lt.id) && !pendingTxInserts.has(lt.id)) {
            // Deleted remotely by another device! Remove from local IndexedDB
            await idbDeleteTransaction(lt.id);
            await idbAddTombstone(lt.id, 'transactions');
            hasLocalDataChanged = true;
          }
        }

        // Save/update remote transactions into local IndexedDB
        if (remoteTransactions) {
          for (const rt of remoteTransactions) {
            if (!tombstonedIds.has(rt.id) && !pendingTxDeletes.has(rt.id)) {
              const splits = rt.splits || [];
              await idbSaveTransaction({ ...rt, sync_status: 'synced' }, splits);
            }
          }
        }
      }
    }

    const remainingQueue = await idbGetSyncQueue();
    notifySyncListeners(remainingQueue.length > 0 ? 'pending' : 'synced', remainingQueue.length);

    if (hasLocalDataChanged || processedCount > 0) {
      notifyDataChange();
    }

    return { success: true, syncedCount: processedCount };
  } catch (error: any) {
    console.error('[Sync Error]:', error);
    const remainingQueue = await idbGetSyncQueue();
    notifySyncListeners('failed', remainingQueue.length);
    return { success: false, syncedCount: processedCount, error: error.message };
  } finally {
    isSyncing = false;
    // If another sync was queued while this one was running, execute it now
    if (queuedSyncUserId) {
      const nextUser = queuedSyncUserId;
      queuedSyncUserId = null;
      runFullSync(nextUser);
    }
  }
}

/**
 * Sets up a Supabase Realtime channel subscription for instant cross-device updates.
 * Directly handles remote DELETE events to immediately remove records from IndexedDB.
 */
export function setupRealtimeSync(userId: string, onDataChanged: () => void): () => void {
  if (!isSupabaseConfigured || !userId || userId.startsWith('demo-')) {
    return () => {};
  }

  const channel = supabase
    .channel(`khata-realtime-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            await idbDeleteTransaction(deletedId);
            await idbAddTombstone(deletedId, 'transactions');
            onDataChanged();
          }
        } else {
          // INSERT or UPDATE: Trigger quick background sync
          runFullSync(userId).then(() => onDataChanged());
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'group_members' },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            await idbDeleteMember(deletedId);
            await idbAddTombstone(deletedId, 'group_members');
            onDataChanged();
          }
        } else {
          runFullSync(userId).then(() => onDataChanged());
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'groups' },
      async (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            await idbDeleteGroup(deletedId);
            await idbAddTombstone(deletedId, 'groups');
            onDataChanged();
          }
        } else {
          runFullSync(userId).then(() => onDataChanged());
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Auto-sync listener when browser reconnects to the network
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    runFullSync();
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      runFullSync();
    }
  });
}

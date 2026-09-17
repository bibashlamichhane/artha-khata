import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  idbGetGroups,
  idbSaveGroup,
  idbDeleteGroup,
  idbGetMembers,
  idbSaveMember,
  idbDeleteMember,
  idbGetTransactions,
  idbSaveTransaction,
  idbDeleteTransaction,
  idbAddToSyncQueue,
  idbClearUserData,
} from '@/lib/indexeddb';
import { runFullSync, subscribeSyncStatus, subscribeDataChange, setupRealtimeSync } from '@/lib/sync';
import { calculateEqualSplits, calculateGroupSettlement, sortTransactionsNewestFirst } from '@/lib/settlement';
import type {
  ExpenseGroup,
  GroupMember,
  ExpenseTransaction,
  TransactionSplit,
  SyncStatus,
  GroupSettlementSummary,
} from '@/types/khata';

export function useKhataData() {
  const { user, isDemoUser, settings } = useAuth();
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Currency from settings or default NPR
  const currency = settings?.currency || 'NPR';

  // Load from IndexedDB
  const reloadLocalData = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setMembers([]);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      const localGroups = await idbGetGroups(user.id);
      const allMembers = await idbGetMembers();
      const allTxs = await idbGetTransactions();

      // Seed initial sample group if demo user and nothing exists yet
      if (localGroups.length === 0 && (isDemoUser || user.id.includes('demo'))) {
        const sampleGroupId = crypto.randomUUID();
        const sampleGroup: ExpenseGroup = {
          id: sampleGroupId,
          owner_id: user.id,
          name: 'Trip to Pokhara',
          description: 'Weekend lake & trek expenses with friends',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };

        const m1: GroupMember = {
          id: crypto.randomUUID(),
          group_id: sampleGroupId,
          name: 'Bikram Giri (You)',
          phone: '+977 9841234567',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        const m2: GroupMember = {
          id: crypto.randomUUID(),
          group_id: sampleGroupId,
          name: 'Bibash',
          phone: '+977 9801234568',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        const m3: GroupMember = {
          id: crypto.randomUUID(),
          group_id: sampleGroupId,
          name: 'Sandesh',
          phone: '+977 9811234569',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        const m4: GroupMember = {
          id: crypto.randomUUID(),
          group_id: sampleGroupId,
          name: 'Janak',
          phone: '+977 9821234570',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };

        const sampleMembers = [m1, m2, m3, m4];
        await idbSaveGroup(sampleGroup);
        for (const m of sampleMembers) await idbSaveMember(m);

        // Transaction 1: Lakeside Lunch (1000 NPR, Bibash paid for all 4)
        const tx1Id = crypto.randomUUID();
        const splits1 = calculateEqualSplits(100000, sampleMembers.map((m) => m.id)).map((s) => ({
          id: crypto.randomUUID(),
          transaction_id: tx1Id,
          ...s,
        }));
        const tx1: ExpenseTransaction = {
          id: tx1Id,
          group_id: sampleGroupId,
          owner_id: user.id,
          description: 'Lakeside Lunch',
          amount: 100000,
          currency: 'NPR',
          paid_by: m2.id, // Bibash
          transaction_date: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        await idbSaveTransaction(tx1, splits1);

        // Transaction 2: Boating at Fewa Lake (1200 NPR, Bikram paid for all 4)
        const tx2Id = crypto.randomUUID();
        const splits2 = calculateEqualSplits(120000, sampleMembers.map((m) => m.id)).map((s) => ({
          id: crypto.randomUUID(),
          transaction_id: tx2Id,
          ...s,
        }));
        const tx2: ExpenseTransaction = {
          id: tx2Id,
          group_id: sampleGroupId,
          owner_id: user.id,
          description: 'Boating at Fewa Lake',
          amount: 120000,
          currency: 'NPR',
          paid_by: m1.id, // Bikram (You)
          transaction_date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        await idbSaveTransaction(tx2, splits2);

        setGroups([sampleGroup]);
        setMembers(sampleMembers);
        setTransactions(sortTransactionsNewestFirst([{ ...tx2, splits: splits2 }, { ...tx1, splits: splits1 }]));
        setIsLoading(false);
        return;
      }

      setGroups(localGroups);
      // Filter members and transactions by user's groups
      const userGroupIds = new Set(localGroups.map((g) => g.id));
      setMembers(allMembers.filter((m) => userGroupIds.has(m.group_id)));
      setTransactions(sortTransactionsNewestFirst(allTxs.filter((t) => userGroupIds.has(t.group_id))));
    } catch (err) {
      console.error('Failed to load local data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isDemoUser]);

  useEffect(() => {
    reloadLocalData();

    const unsubscribeStatus = subscribeSyncStatus((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
    });

    const unsubscribeData = subscribeDataChange(() => {
      reloadLocalData();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeData();
    };
  }, [reloadLocalData]);

  // Trigger background sync when online and setup realtime listener
  useEffect(() => {
    if (user && !isDemoUser && isSupabaseConfigured && navigator.onLine) {
      runFullSync(user.id).then(() => reloadLocalData());
      const cleanupRealtime = setupRealtimeSync(user.id, () => {
        reloadLocalData();
      });
      return () => {
        cleanupRealtime();
      };
    }
  }, [user, isDemoUser, reloadLocalData]);

  // ---------------- Operations ----------------

  const createGroup = async (name: string, description?: string): Promise<ExpenseGroup> => {
    if (!user) throw new Error('User not authenticated');
    const newGroup: ExpenseGroup = {
      id: crypto.randomUUID(),
      owner_id: user.id,
      name,
      description: description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: navigator.onLine && !isDemoUser ? 'synced' : 'pending',
    };

    await idbSaveGroup(newGroup);
    setGroups((prev) => [newGroup, ...prev]);

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id: newGroup.id,
        table: 'groups',
        action: 'insert',
        payload: {
          id: newGroup.id,
          owner_id: newGroup.owner_id,
          name: newGroup.name,
          description: newGroup.description,
          created_at: newGroup.created_at,
          updated_at: newGroup.updated_at,
        },
      });
      runFullSync(user.id);
    }

    return newGroup;
  };

  const updateGroup = async (id: string, name: string, description?: string) => {
    const existing = groups.find((g) => g.id === id);
    if (!existing) return;
    const updated: ExpenseGroup = {
      ...existing,
      name,
      description: description ?? existing.description,
      updated_at: new Date().toISOString(),
      sync_status: navigator.onLine && !isDemoUser ? 'synced' : 'pending',
    };

    await idbSaveGroup(updated);
    setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id: updated.id,
        table: 'groups',
        action: 'update',
        payload: { name: updated.name, description: updated.description, updated_at: updated.updated_at },
      });
      runFullSync(user?.id);
    }
  };

  const deleteGroup = async (id: string) => {
    await idbDeleteGroup(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setMembers((prev) => prev.filter((m) => m.group_id !== id));
    setTransactions((prev) => prev.filter((t) => t.group_id !== id));

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id,
        table: 'groups',
        action: 'delete',
        payload: null,
      });
      runFullSync(user?.id);
    }
  };

  const addMember = async (groupId: string, name: string, phone?: string, photo_url?: string): Promise<GroupMember> => {
    const newMember: GroupMember = {
      id: crypto.randomUUID(),
      group_id: groupId,
      name,
      phone: phone || null,
      photo_url: photo_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: navigator.onLine && !isDemoUser ? 'synced' : 'pending',
    };

    await idbSaveMember(newMember);
    setMembers((prev) => [...prev, newMember]);

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id: newMember.id,
        table: 'group_members',
        action: 'insert',
        payload: {
          id: newMember.id,
          group_id: newMember.group_id,
          name: newMember.name,
          phone: newMember.phone,
          photo_url: newMember.photo_url,
          created_at: newMember.created_at,
          updated_at: newMember.updated_at,
        },
      });
      runFullSync(user?.id);
    }

    return newMember;
  };

  const updateMember = async (id: string, name: string, phone?: string, photo_url?: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return;
    const updated: GroupMember = {
      ...existing,
      name,
      phone: phone !== undefined ? phone : existing.phone,
      photo_url: photo_url !== undefined ? photo_url : existing.photo_url,
      updated_at: new Date().toISOString(),
      sync_status: navigator.onLine && !isDemoUser ? 'synced' : 'pending',
    };

    await idbSaveMember(updated);
    setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id: updated.id,
        table: 'group_members',
        action: 'update',
        payload: {
          name: updated.name,
          phone: updated.phone,
          photo_url: updated.photo_url,
          updated_at: updated.updated_at,
        },
      });
      runFullSync(user?.id);
    }
  };

  const deleteMember = async (id: string) => {
    await idbDeleteMember(id);
    setMembers((prev) => prev.filter((m) => m.id !== id));

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id,
        table: 'group_members',
        action: 'delete',
        payload: null,
      });
      runFullSync(user?.id);
    }
  };

  const addTransaction = async (data: {
    groupId: string;
    description: string;
    amountMinor: number;
    paidBy: string;
    splitMemberIds: string[];
    transactionDate?: string;
  }): Promise<ExpenseTransaction> => {
    if (!user) throw new Error('User not authenticated');
    const txId = crypto.randomUUID();
    const splitCalculations = calculateEqualSplits(data.amountMinor, data.splitMemberIds);

    const splits: TransactionSplit[] = splitCalculations.map((sc) => ({
      id: crypto.randomUUID(),
      transaction_id: txId,
      member_id: sc.member_id,
      share_amount: sc.share_amount,
      created_at: new Date().toISOString(),
    }));

    const newTx: ExpenseTransaction = {
      id: txId,
      group_id: data.groupId,
      owner_id: user.id,
      description: data.description,
      amount: data.amountMinor,
      currency,
      paid_by: data.paidBy,
      transaction_date: data.transactionDate || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: navigator.onLine && !isDemoUser ? 'synced' : 'pending',
      splits,
    };

    await idbSaveTransaction(newTx, splits);
    setTransactions((prev) => sortTransactionsNewestFirst([newTx, ...prev]));

    if (!isDemoUser) {
      // Add transaction insert to queue
      await idbAddToSyncQueue({
        id: newTx.id,
        table: 'transactions',
        action: 'insert',
        payload: {
          id: newTx.id,
          group_id: newTx.group_id,
          owner_id: newTx.owner_id,
          description: newTx.description,
          amount: newTx.amount,
          currency: newTx.currency,
          paid_by: newTx.paid_by,
          transaction_date: newTx.transaction_date,
          created_at: newTx.created_at,
          updated_at: newTx.updated_at,
        },
      });

      // Add splits to queue
      for (const split of splits) {
        await idbAddToSyncQueue({
          id: split.id,
          table: 'transaction_splits',
          action: 'insert',
          payload: {
            id: split.id,
            transaction_id: split.transaction_id,
            member_id: split.member_id,
            share_amount: split.share_amount,
            created_at: split.created_at,
          },
        });
      }

      runFullSync(user.id);
    }

    return newTx;
  };

  const deleteTransaction = async (id: string) => {
    await idbDeleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    if (!isDemoUser) {
      await idbAddToSyncQueue({
        id,
        table: 'transactions',
        action: 'delete',
        payload: null,
      });
      runFullSync(user?.id);
    }
  };

  const resetAllUserData = async () => {
    if (!user) return;
    setIsLoading(true);
    // Delete in Supabase if online
    if (!isDemoUser && isSupabaseConfigured && navigator.onLine) {
      await supabase.from('groups').delete().eq('owner_id', user.id);
    }
    await idbClearUserData();
    setGroups([]);
    setMembers([]);
    setTransactions([]);
    setIsLoading(false);
  };

  // ---------------- Settlements & Aggregations ----------------

  // Overall settlement across all groups
  const overallSettlement = useMemo(() => {
    return calculateGroupSettlement(members, transactions, 'overall', currency);
  }, [members, transactions, currency]);

  // Settlements grouped by group ID
  const settlementsByGroup = useMemo(() => {
    const map = new Map<string, GroupSettlementSummary>();
    for (const group of groups) {
      const gMembers = members.filter((m) => m.group_id === group.id);
      const gTxs = transactions.filter((t) => t.group_id === group.id);
      map.set(group.id, calculateGroupSettlement(gMembers, gTxs, group.id, currency));
    }
    return map;
  }, [groups, members, transactions, currency]);

  return {
    groups,
    members,
    transactions,
    currency,
    syncStatus,
    pendingCount,
    isLoading,
    overallSettlement,
    settlementsByGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    addMember,
    updateMember,
    deleteMember,
    addTransaction,
    deleteTransaction,
    reloadLocalData,
    resetAllUserData,
    syncNow: () => runFullSync(user?.id),
  };
}

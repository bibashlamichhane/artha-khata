import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ExpenseGroup, GroupMember, ExpenseTransaction, TransactionSplit, UserProfile, UserSettings } from '@/types/khata';

interface KhataDBSchema extends DBSchema {
  groups: {
    key: string;
    value: ExpenseGroup;
    indexes: { 'by-owner': string };
  };
  members: {
    key: string;
    value: GroupMember;
    indexes: { 'by-group': string };
  };
  transactions: {
    key: string;
    value: ExpenseTransaction;
    indexes: { 'by-group': string; 'by-owner': string; 'by-date': string };
  };
  splits: {
    key: string;
    value: TransactionSplit;
    indexes: { 'by-transaction': string; 'by-member': string };
  };
  profile: {
    key: string;
    value: UserProfile;
  };
  settings: {
    key: string;
    value: UserSettings;
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      table: 'groups' | 'group_members' | 'transactions' | 'transaction_splits' | 'user_settings' | 'profiles';
      action: 'insert' | 'update' | 'delete';
      payload: any;
      created_at: string;
      retry_count: number;
    };
  };
}

const DB_NAME = 'khata_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<KhataDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<KhataDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<KhataDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Groups store
        if (!db.objectStoreNames.contains('groups')) {
          const groupStore = db.createObjectStore('groups', { keyPath: 'id' });
          groupStore.createIndex('by-owner', 'owner_id');
        }

        // Members store
        if (!db.objectStoreNames.contains('members')) {
          const memberStore = db.createObjectStore('members', { keyPath: 'id' });
          memberStore.createIndex('by-group', 'group_id');
        }

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('by-group', 'group_id');
          txStore.createIndex('by-owner', 'owner_id');
          txStore.createIndex('by-date', 'transaction_date');
        }

        // Splits store
        if (!db.objectStoreNames.contains('splits')) {
          const splitStore = db.createObjectStore('splits', { keyPath: 'id' });
          splitStore.createIndex('by-transaction', 'transaction_id');
          splitStore.createIndex('by-member', 'member_id');
        }

        // Profile store
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ----------------- IndexedDB Helper CRUD -----------------

export async function idbSaveGroup(group: ExpenseGroup): Promise<void> {
  const db = await getDB();
  await db.put('groups', group);
}

export async function idbGetGroups(ownerId?: string): Promise<ExpenseGroup[]> {
  const db = await getDB();
  const all = await db.getAll('groups');
  if (ownerId) {
    return all.filter((g) => g.owner_id === ownerId);
  }
  return all;
}

export async function idbGetGroup(id: string): Promise<ExpenseGroup | undefined> {
  const db = await getDB();
  return db.get('groups', id);
}

export async function idbDeleteGroup(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['groups', 'members', 'transactions', 'splits'], 'readwrite');
  
  // Delete associated transactions & splits
  const allTx = await tx.objectStore('transactions').index('by-group').getAll(id);
  for (const t of allTx) {
    const splits = await tx.objectStore('splits').index('by-transaction').getAll(t.id);
    for (const s of splits) {
      await tx.objectStore('splits').delete(s.id);
    }
    await tx.objectStore('transactions').delete(t.id);
  }

  // Delete members
  const members = await tx.objectStore('members').index('by-group').getAll(id);
  for (const m of members) {
    await tx.objectStore('members').delete(m.id);
  }

  // Delete group
  await tx.objectStore('groups').delete(id);
  await tx.done;
}

export async function idbSaveMember(member: GroupMember): Promise<void> {
  const db = await getDB();
  await db.put('members', member);
}

export async function idbGetMembers(groupId?: string): Promise<GroupMember[]> {
  const db = await getDB();
  if (groupId) {
    return db.getAllFromIndex('members', 'by-group', groupId);
  }
  return db.getAll('members');
}

export async function idbDeleteMember(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('members', id);
}

export async function idbSaveTransaction(
  transaction: ExpenseTransaction,
  splits: TransactionSplit[]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['transactions', 'splits'], 'readwrite');
  await tx.objectStore('transactions').put({ ...transaction, splits });
  for (const split of splits) {
    await tx.objectStore('splits').put(split);
  }
  await tx.done;
}

export async function idbGetTransactions(groupId?: string): Promise<ExpenseTransaction[]> {
  const db = await getDB();
  let list: ExpenseTransaction[];
  if (groupId) {
    list = await db.getAllFromIndex('transactions', 'by-group', groupId);
  } else {
    list = await db.getAll('transactions');
  }

  // Populate splits for each transaction
  const allSplits = await db.getAll('splits');
  const splitMap = new Map<string, TransactionSplit[]>();
  for (const s of allSplits) {
    const arr = splitMap.get(s.transaction_id) || [];
    arr.push(s);
    splitMap.set(s.transaction_id, arr);
  }

  return list.map((t) => ({
    ...t,
    splits: splitMap.get(t.id) || t.splits || [],
  })).sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
}

export async function idbDeleteTransaction(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['transactions', 'splits'], 'readwrite');
  const splits = await tx.objectStore('splits').index('by-transaction').getAll(id);
  for (const s of splits) {
    await tx.objectStore('splits').delete(s.id);
  }
  await tx.objectStore('transactions').delete(id);
  await tx.done;
}

export async function idbSaveProfile(profile: UserProfile): Promise<void> {
  const db = await getDB();
  await db.put('profile', profile);
}

export async function idbGetProfile(userId: string): Promise<UserProfile | undefined> {
  const db = await getDB();
  return db.get('profile', userId);
}

export async function idbSaveSettings(settings: UserSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

export async function idbGetSettings(userId?: string): Promise<UserSettings | undefined> {
  const db = await getDB();
  if (userId) {
    const all = await db.getAll('settings');
    return all.find((s) => s.user_id === userId);
  }
  const all = await db.getAll('settings');
  return all[0];
}

// ----------------- Sync Queue Helpers -----------------

export async function idbAddToSyncQueue(item: {
  id: string;
  table: 'groups' | 'group_members' | 'transactions' | 'transaction_splits' | 'user_settings' | 'profiles';
  action: 'insert' | 'update' | 'delete';
  payload: any;
}): Promise<void> {
  const db = await getDB();
  await db.put('sync_queue', {
    ...item,
    created_at: new Date().toISOString(),
    retry_count: 0,
  });
}

export async function idbGetSyncQueue(): Promise<any[]> {
  const db = await getDB();
  return db.getAll('sync_queue');
}

export async function idbRemoveFromSyncQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function idbClearUserData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['groups', 'members', 'transactions', 'splits', 'profile', 'settings', 'sync_queue'],
    'readwrite'
  );
  await tx.objectStore('groups').clear();
  await tx.objectStore('members').clear();
  await tx.objectStore('transactions').clear();
  await tx.objectStore('splits').clear();
  await tx.objectStore('profile').clear();
  await tx.objectStore('settings').clear();
  await tx.objectStore('sync_queue').clear();
  await tx.done;
}

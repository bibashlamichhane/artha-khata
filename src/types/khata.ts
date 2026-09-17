export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

export interface UserProfile {
  id: string; // auth.users.id
  name: string;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  currency: string;
  company_name: string;
  company_logo_url?: string | null;
  theme: 'light' | 'dark';
  created_at: string;
  updated_at: string;
}

export interface ExpenseGroup {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
}

export interface GroupMember {
  id: string;
  group_id: string;
  name: string;
  phone?: string | null;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
}

export interface ExpenseTransaction {
  id: string;
  group_id: string;
  owner_id: string;
  description: string;
  amount: number; // Stored in minor currency units (e.g. 1500 NPR = 150000 paisa)
  currency: string;
  paid_by: string; // group_members.id
  transaction_date: string;
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
  splits?: TransactionSplit[];
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  member_id: string;
  share_amount: number; // Stored in minor currency units
  created_at?: string;
}

export interface MemberBalance {
  member_id: string;
  name: string;
  phone?: string | null;
  photo_url?: string | null;
  total_paid: number; // minor units
  total_share: number; // minor units
  net_balance: number; // minor units: >0 means should receive, <0 means needs to pay
}

export interface DebtSettlement {
  id: string;
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  amount: number; // minor units
  formatted_amount: string;
}

export interface GroupSettlementSummary {
  group_id: string;
  total_spending: number; // minor units
  balances: Record<string, MemberBalance>;
  settlements: DebtSettlement[];
  rotating_messages: string[];
}

export type DateFilterType = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';

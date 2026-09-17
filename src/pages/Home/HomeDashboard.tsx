import React, { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  Receipt,
  TrendingUp,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  FolderPlus,
} from 'lucide-react';
import { formatCurrency } from '@/lib/settlement';
import { generateAndDownloadBill } from '@/lib/bill';
import { AddSplitModal } from '../Groups/AddSplitModal';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import type {
  ExpenseGroup,
  GroupMember,
  ExpenseTransaction,
  GroupSettlementSummary,
  UserSettings,
  UserProfile,
} from '@/types/khata';

interface HomeDashboardProps {
  userProfile: UserProfile | null;
  settings?: UserSettings | null;
  groups: ExpenseGroup[];
  members: GroupMember[];
  transactions: ExpenseTransaction[];
  overallSettlement: GroupSettlementSummary;
  currency: string;
  onNavigateToGroups: () => void;
  onSelectGroup: (groupId: string) => void;
  onAddTransaction: (data: any) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onCreateGroup: (name: string, description?: string) => Promise<any>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  userProfile,
  settings,
  groups,
  members,
  transactions,
  overallSettlement,
  currency,
  onNavigateToGroups,
  onSelectGroup,
  onAddTransaction,
  onDeleteTransaction,
  onCreateGroup,
  onToast,
}) => {
  // Rotating settlement message index
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [isAddSplitOpen, setIsAddSplitOpen] = useState(false);
  const [selectedGroupForSplit, setSelectedGroupForSplit] = useState<ExpenseGroup | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [txToDelete, setTxToDelete] = useState<ExpenseTransaction | null>(null);

  const memberMap = new Map<string, GroupMember>();
  for (const m of members) memberMap.set(m.id, m);

  const groupMap = new Map<string, ExpenseGroup>();
  for (const g of groups) groupMap.set(g.id, g);

  const rotatingMessages = overallSettlement.rotating_messages;

  // Auto-rotate ticker every 4.5 seconds
  useEffect(() => {
    if (rotatingMessages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveMessageIndex((prev) => (prev + 1) % rotatingMessages.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [rotatingMessages.length]);

  const handleOpenAddSplit = () => {
    if (groups.length === 0) {
      setIsCreateGroupOpen(true);
      return;
    }
    setSelectedGroupForSplit(groups[0]);
    setIsAddSplitOpen(true);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const g = await onCreateGroup(newGroupName.trim(), newGroupDesc.trim() || undefined);
      setNewGroupName('');
      setNewGroupDesc('');
      setIsCreateGroupOpen(false);
      onToast('success', `Group "${g.name}" created!`);
      onSelectGroup(g.id);
    } catch (err: any) {
      onToast('error', err.message || 'Failed to create group');
    }
  };

  const handleBill = async (tx: ExpenseTransaction) => {
    try {
      const g = groupMap.get(tx.group_id) || {
        id: tx.group_id,
        name: 'Expense Group',
        owner_id: '',
        created_at: '',
        updated_at: '',
      };
      const payer = memberMap.get(tx.paid_by) || {
        id: tx.paid_by,
        group_id: tx.group_id,
        name: 'Group Member',
        created_at: '',
        updated_at: '',
      };
      const splits = (tx.splits || []).map((s) => ({
        member: memberMap.get(s.member_id) || {
          id: s.member_id,
          group_id: tx.group_id,
          name: 'Member',
          created_at: '',
          updated_at: '',
        },
        share_amount: s.share_amount,
      }));

      await generateAndDownloadBill({
        transaction: tx,
        group: g,
        paidByMember: payer,
        splitMembers: splits,
        settings,
      });
      onToast('success', 'Bill receipt generated and downloaded.');
    } catch (e: any) {
      onToast('error', 'Could not generate receipt image.');
    }
  };

  const recentTransactions = transactions.slice(0, 6);

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Namaste, {userProfile?.name?.split(' ')[0] || 'Member'}! 👋
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track expenses, calculate splits, and manage settlements effortlessly.
          </p>
        </div>

        <button
          onClick={handleOpenAddSplit}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Group Split</span>
        </button>
      </div>

      {/* Dynamic Rotating Settlement Message Banner (Requirement #10) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/40 border border-emerald-500/20 shadow-sm flex items-center justify-between gap-3 overflow-hidden">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active Settlement Ticker
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate transition-all duration-300">
              {rotatingMessages[activeMessageIndex] || 'All balances are settled!'}
            </p>
          </div>
        </div>

        {rotatingMessages.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            {rotatingMessages.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === activeMessageIndex
                    ? 'bg-emerald-600 dark:bg-emerald-400 w-3'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Spending
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatCurrency(overallSettlement.total_spending, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {transactions.length} total transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Groups
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {groups.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {members.length} registered member{members.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Outstanding Dues
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {overallSettlement.settlements.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Pending peer-to-peer settlement{overallSettlement.settlements.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Your Groups Grid preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>Your Expense Groups</span>
          </h3>
          <button
            onClick={onNavigateToGroups}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
            <FolderPlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No groups created yet
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-3">
              Create a group (e.g. &quot;Flatmates&quot;, &quot;Office Lunch&quot;, &quot;Trip&quot;) to start splitting.
            </p>
            <button
              onClick={() => setIsCreateGroupOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white"
            >
              Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group) => {
              const groupMembers = members.filter((m) => m.group_id === group.id);
              const groupTxs = transactions.filter((t) => t.group_id === group.id);
              const groupTotal = groupTxs.reduce((acc, t) => acc + t.amount, 0);

              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm transition cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                        {group.name}
                      </h4>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition shrink-0" />
                    </div>
                    {group.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {formatCurrency(groupTotal, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Transactions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            <span>Recent Activity ({transactions.length})</span>
          </h3>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-400">
            No transactions recorded yet. Tap &quot;+ Add Group Split&quot; to begin!
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentTransactions.map((tx) => {
              const payer = memberMap.get(tx.paid_by);
              const group = groupMap.get(tx.group_id);
              const txDate = new Date(tx.transaction_date);

              return (
                <div
                  key={tx.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {tx.description}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {group?.name || 'Group'} • Paid by {payer?.name || 'Member'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono block">
                        {formatCurrency(tx.amount, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <button
                      onClick={() => handleBill(tx)}
                      title="Download Bill Receipt"
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Split Modal */}
      {isAddSplitOpen && selectedGroupForSplit && (
        <AddSplitModal
          isOpen={isAddSplitOpen}
          onClose={() => setIsAddSplitOpen(false)}
          group={selectedGroupForSplit}
          members={members.filter((m) => m.group_id === selectedGroupForSplit.id)}
          currency={currency}
          onAddTransaction={async (data) => {
            await onAddTransaction(data);
            onToast('success', 'Expense split successfully recorded.');
          }}
        />
      )}

      {/* Create Group Modal */}
      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Create New Group
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Give your group a name and optional description.
            </p>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Trip to Pokhara, Flat Rent, Lunch Club"
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Shared expenses for our weekend getaway"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

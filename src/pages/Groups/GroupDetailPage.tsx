import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  UserPlus,
  Receipt,
  Plus,
  Trash2,
  Download,
  Phone,
  Users,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, sortTransactionsNewestFirst } from '@/lib/settlement';
import { generateAndDownloadBill } from '@/lib/bill';
import { AddSplitModal } from './AddSplitModal';
import { MemberProfileModal } from './MemberProfileModal';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import type {
  ExpenseGroup,
  GroupMember,
  ExpenseTransaction,
  GroupSettlementSummary,
  UserSettings,
} from '@/types/khata';

interface GroupDetailPageProps {
  group: ExpenseGroup;
  members: GroupMember[];
  transactions: ExpenseTransaction[];
  settlement: GroupSettlementSummary;
  currency: string;
  settings?: UserSettings | null;
  onBack: () => void;
  onAddTransaction: (data: any) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddMember: (groupId: string, name: string, phone?: string, photo_url?: string) => Promise<any>;
  onUpdateMember: (id: string, name: string, phone?: string, photo_url?: string) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const GroupDetailPage: React.FC<GroupDetailPageProps> = ({
  group,
  members,
  transactions,
  settlement,
  currency,
  settings,
  onBack,
  onAddTransaction,
  onDeleteTransaction,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onToast,
}) => {
  // Modals
  const [isAddSplitOpen, setIsAddSplitOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [txToDelete, setTxToDelete] = useState<ExpenseTransaction | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<GroupMember | null>(null);

  // New Member Form
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Bill generation loading state
  const [generatingBillId, setGeneratingBillId] = useState<string | null>(null);

  const memberMap = new Map<string, GroupMember>();
  for (const m of members) memberMap.set(m.id, m);

  // Group transactions deterministically sorted newest-first (NEW -> OLDER -> OLDEST)
  const sortedTransactions = useMemo(() => sortTransactionsNewestFirst(transactions), [transactions]);

  // Handle Bill Generation
  const handleGenerateBill = async (tx: ExpenseTransaction) => {
    try {
      setGeneratingBillId(tx.id);
      const payer = memberMap.get(tx.paid_by) || {
        id: tx.paid_by,
        group_id: group.id,
        name: 'Group Member',
        created_at: '',
        updated_at: '',
      };

      const splitItems = (tx.splits || []).map((s) => ({
        member: memberMap.get(s.member_id) || {
          id: s.member_id,
          group_id: group.id,
          name: 'Member',
          created_at: '',
          updated_at: '',
        },
        share_amount: s.share_amount,
      }));

      await generateAndDownloadBill({
        transaction: tx,
        group,
        paidByMember: payer,
        splitMembers: splitItems,
        settings,
      });

      onToast('success', 'Receipt downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      onToast('error', 'Failed to generate receipt image.');
    } finally {
      setGeneratingBillId(null);
    }
  };

  // Add Member Submission
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setIsAddingMember(true);
    try {
      await onAddMember(group.id, newMemberName.trim(), newMemberPhone.trim() || undefined);
      setNewMemberName('');
      setNewMemberPhone('');
      setIsAddMemberOpen(false);
      onToast('success', `${newMemberName.trim()} added to ${group.name}`);
    } catch (e: any) {
      onToast('error', e.message || 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Back to all groups"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {group.name}
            </h2>
            {group.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-500" />
            <span>Add Member</span>
          </button>

          <button
            onClick={() => setIsAddSplitOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Group Split</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Group Spending
          </span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {formatCurrency(settlement.total_spending, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {transactions.length} recorded transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm md:col-span-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Settlement Status &amp; Debts
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {settlement.settlements.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-900/60">
                All balances are balanced! No outstanding dues.
              </span>
            ) : (
              settlement.settlements.map((s) => (
                <div
                  key={s.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {s.from_name}
                  </span>
                  <span className="text-slate-400 text-[10px]">owes</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {s.to_name}
                  </span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white ml-1">
                    {s.formatted_amount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>Group Members ({members.length})</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click member to view profile &amp; settlement slip
          </span>
        </div>

        {members.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No members in this group yet
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Add members before splitting expenses.
            </p>
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white"
            >
              Add First Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {members.map((member) => {
              const bal = settlement.balances[member.id];
              const net = bal?.net_balance || 0;
              const isCreditor = net > 0;
              const isDebtor = net < 0;

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 shadow-sm transition cursor-pointer group relative"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-300 overflow-hidden">
                        {member.photo_url ? (
                          <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          member.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition">
                          {member.name}
                        </p>
                        {member.phone && (
                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{member.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToDelete(member);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded-lg transition"
                      title="Remove Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Net Status</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        isCreditor
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isDebtor
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatCurrency(net, currency, true)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            <span>Group Transactions ({transactions.length})</span>
          </h3>
        </div>

        {sortedTransactions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
            <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No transactions yet
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Click &quot;Add Group Split&quot; to divide an expense among members.
            </p>
            <button
              onClick={() => setIsAddSplitOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white"
            >
              Add First Transaction
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedTransactions.map((tx) => {
              const payer = memberMap.get(tx.paid_by);
              const txDate = new Date(tx.transaction_date);
              const dateFormatted = txDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const timeFormatted = txDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              const splitCount = tx.splits?.length || 0;

              return (
                <div
                  key={tx.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {tx.description}
                        </h4>
                        {tx.sync_status === 'pending' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-medium">
                            Pending Sync
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Paid by <strong className="text-slate-700 dark:text-slate-200">{payer?.name || 'Member'}</strong> • Split among {splitCount} person{splitCount !== 1 ? 's' : ''}
                      </p>

                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{dateFormatted} at {timeFormatted}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono block">
                        {formatCurrency(tx.amount, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ~{formatCurrency(splitCount > 0 ? Math.round(tx.amount / splitCount) : tx.amount, currency)} / person
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Generate Bill Button */}
                      <button
                        onClick={() => handleGenerateBill(tx)}
                        disabled={generatingBillId === tx.id}
                        title="Download Bill Receipt Image"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Bill</span>
                      </button>

                      {/* Delete Transaction Button */}
                      <button
                        onClick={() => setTxToDelete(tx)}
                        title="Delete Transaction (Requires security confirmation)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Split Modal */}
      {isAddSplitOpen && (
        <AddSplitModal
          isOpen={isAddSplitOpen}
          onClose={() => setIsAddSplitOpen(false)}
          group={group}
          members={members}
          currency={currency}
          onAddTransaction={async (data) => {
            await onAddTransaction(data);
            onToast('success', 'Transaction saved and splits calculated.');
          }}
        />
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Add Member to {group.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter the member details to split expenses.
            </p>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Member Name *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Bibash, Sandesh"
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  placeholder="+977 98..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingMember}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Profile Modal */}
      {selectedMember && (
        <MemberProfileModal
          isOpen={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          member={selectedMember}
          allMembers={members}
          transactions={transactions}
          balance={settlement.balances[selectedMember.id]}
          balances={settlement.balances}
          settlements={settlement.settlements}
          currency={currency}
          onUpdateMember={onUpdateMember}
        />
      )}

      {/* Security Confirm Delete Transaction Modal (Must type 100) */}
      {txToDelete && (
        <ConfirmDeleteModal
          isOpen={!!txToDelete}
          title="Delete Transaction"
          description={`Are you sure you want to delete "${txToDelete.description}" (${formatCurrency(txToDelete.amount, currency)})? All group member balances and settlement calculations will be recalculated.`}
          requiredConfirmation="100"
          confirmButtonText="Delete Transaction"
          onConfirm={async () => {
            if (txToDelete) {
              await onDeleteTransaction(txToDelete.id);
              onToast('success', 'Transaction deleted and balances updated.');
              setTxToDelete(null);
            }
          }}
          onCancel={() => setTxToDelete(null)}
        />
      )}

      {/* Confirm Delete Member Modal */}
      {memberToDelete && (
        <ConfirmDeleteModal
          isOpen={!!memberToDelete}
          title="Remove Group Member"
          description={`Remove ${memberToDelete.name} from this group?`}
          requiredConfirmation="100"
          confirmButtonText="Remove Member"
          onConfirm={async () => {
            if (memberToDelete) {
              await onDeleteMember(memberToDelete.id);
              onToast('success', `${memberToDelete.name} removed.`);
              setMemberToDelete(null);
            }
          }}
          onCancel={() => setMemberToDelete(null)}
        />
      )}
    </div>
  );
};

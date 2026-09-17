import React, { useState, useEffect } from 'react';
import { X, Receipt, Check, Users, DollarSign, Calendar } from 'lucide-react';
import { toMinorUnits, formatCurrency, calculateEqualSplits } from '@/lib/settlement';
import type { GroupMember, ExpenseGroup } from '@/types/khata';

interface AddSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: ExpenseGroup;
  groups?: ExpenseGroup[];
  members?: GroupMember[];
  allMembers?: GroupMember[];
  currency: string;
  onAddTransaction: (data: {
    groupId: string;
    description: string;
    amountMinor: number;
    paidBy: string;
    splitMemberIds: string[];
    transactionDate?: string;
  }) => Promise<void>;
}

export const AddSplitModal: React.FC<AddSplitModalProps> = ({
  isOpen,
  onClose,
  group,
  groups,
  members,
  allMembers,
  currency,
  onAddTransaction,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    group?.id || (groups && groups[0]?.id) || ''
  );
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine active group
  const activeGroup = (groups && groups.find((g) => g.id === selectedGroupId)) || group || groups?.[0];

  // Determine active members for the chosen group
  const activeMembers: GroupMember[] = React.useMemo(() => {
    if (allMembers && allMembers.length > 0 && activeGroup) {
      return allMembers.filter((m) => m.group_id === activeGroup.id);
    }
    return members || [];
  }, [allMembers, activeGroup, members]);

  // Sync selected group when modal opens or group prop changes
  useEffect(() => {
    if (isOpen) {
      const initialGroupId = group?.id || (groups && groups[0]?.id) || '';
      setSelectedGroupId(initialGroupId);
      setDescription('');
      setAmountInput('');
      setTxDate(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen, group?.id, groups]);

  // Sync paidBy and participants whenever activeMembers changes
  useEffect(() => {
    if (isOpen && activeMembers.length > 0) {
      setPaidBy((prev) => (activeMembers.some((m) => m.id === prev) ? prev : activeMembers[0].id));
      setSelectedMemberIds(activeMembers.map((m) => m.id));
    } else if (isOpen && activeMembers.length === 0) {
      setPaidBy('');
      setSelectedMemberIds([]);
    }
  }, [isOpen, activeMembers]);

  if (!isOpen) return null;

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedMemberIds(activeMembers.map((m) => m.id));
  const deselectAll = () => setSelectedMemberIds([]);

  // Calculate live split preview
  const parsedAmountMinor = toMinorUnits(amountInput);
  const splitCalculations = calculateEqualSplits(parsedAmountMinor, selectedMemberIds);
  const sampleShareMinor = splitCalculations.length > 0 ? splitCalculations[0].share_amount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeGroup) {
      setError('Please select a group for this expense.');
      return;
    }

    if (activeMembers.length === 0) {
      setError('Please add members to this group first before splitting expenses.');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description for this expense.');
      return;
    }

    if (parsedAmountMinor <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!paidBy) {
      setError('Please select who paid for this expense.');
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError('Please select at least one member to split the expense with.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddTransaction({
        groupId: activeGroup.id,
        description: description.trim(),
        amountMinor: parsedAmountMinor,
        paidBy,
        splitMemberIds: selectedMemberIds,
        transactionDate: new Date(txDate).toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Group Split
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeGroup ? `Group: ${activeGroup.name}` : 'Divide expense among members'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Group Selector (when multiple groups exist or opened from Home) */}
          {groups && groups.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Expense Group *
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {groups.map((g) => {
                  const mCount = (allMembers || []).filter((m) => m.group_id === g.id).length;
                  return (
                    <option key={g.id} value={g.id}>
                      {g.name} ({mCount} {mCount === 1 ? 'member' : 'members'})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Warning if no members in group */}
          {activeMembers.length === 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 text-xs">
              This group doesn&apos;t have any members yet. Please add members to the group before splitting an expense.
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Expense Description *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner, Taxi, Hotel, Grocery"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Amount & Date in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Amount ({currency}) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-14 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Paid By Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Paid By *
            </label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              disabled={activeMembers.length === 0}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {activeMembers.length === 0 ? (
                <option value="">No members available</option>
              ) : (
                activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.phone ? `(${m.phone})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Split With Multi-Select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Split With ({selectedMemberIds.length} of {activeMembers.length} selected)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={activeMembers.length === 0}
                  className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                >
                  All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  disabled={activeMembers.length === 0}
                  className="text-[11px] font-medium text-slate-500 hover:underline disabled:opacity-50"
                >
                  None
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              {activeMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="truncate">{member.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time split preview card */}
          {parsedAmountMinor > 0 && selectedMemberIds.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Calculated Split Share
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {selectedMemberIds.length} participant{selectedMemberIds.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(sampleShareMinor, currency)}
                </p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                  per person
                </p>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || activeMembers.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : activeMembers.length === 0 ? (
                'No Members in Group'
              ) : (
                'Save Transaction'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

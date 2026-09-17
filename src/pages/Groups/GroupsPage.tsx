import React, { useState } from 'react';
import { Plus, Users, FolderPlus, MoreVertical, Edit2, Trash2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/settlement';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import type { ExpenseGroup, GroupMember, ExpenseTransaction, GroupSettlementSummary } from '@/types/khata';

interface GroupsPageProps {
  groups: ExpenseGroup[];
  members: GroupMember[];
  transactions: ExpenseTransaction[];
  settlementsByGroup: Map<string, GroupSettlementSummary>;
  currency: string;
  onSelectGroup: (id: string) => void;
  onCreateGroup: (name: string, description?: string) => Promise<any>;
  onUpdateGroup: (id: string, name: string, description?: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const GroupsPage: React.FC<GroupsPageProps> = ({
  groups,
  members,
  transactions,
  settlementsByGroup,
  currency,
  onSelectGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onToast,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroup | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<ExpenseGroup | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const g = await onCreateGroup(name.trim(), desc.trim() || undefined);
      setName('');
      setDesc('');
      setIsCreateOpen(false);
      onToast('success', `Group "${g.name}" created!`);
      onSelectGroup(g.id);
    } catch (e: any) {
      onToast('error', e.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !name.trim()) return;
    setIsSubmitting(true);
    try {
      await onUpdateGroup(editingGroup.id, name.trim(), desc.trim() || undefined);
      setEditingGroup(null);
      setName('');
      setDesc('');
      onToast('success', 'Group updated successfully.');
    } catch (e: any) {
      onToast('error', e.message || 'Failed to update group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Expense Groups
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize trips, apartments, teams, and family ledgers.
          </p>
        </div>

        <button
          onClick={() => {
            setName('');
            setDesc('');
            setIsCreateOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Group</span>
        </button>
      </div>

      {/* Group List */}
      {groups.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 text-center">
          <FolderPlus className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No groups created yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5 max-w-sm mx-auto">
            Create your first group to start adding members and tracking split expenses.
          </p>
          <button
            onClick={() => {
              setName('');
              setDesc('');
              setIsCreateOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-md hover:bg-emerald-500 transition"
          >
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const groupMembers = members.filter((m) => m.group_id === group.id);
            const groupTxs = transactions.filter((t) => t.group_id === group.id);
            const summary = settlementsByGroup.get(group.id);
            const totalSpending = summary?.total_spending || 0;
            const outstandingCount = summary?.settlements.length || 0;

            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="overflow-hidden">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition truncate">
                        {group.name}
                      </h3>
                      {group.description ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {group.description}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1 italic">
                          No description provided
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroup(group);
                          setName(group.name);
                          setDesc(group.description || '');
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Edit Group"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroupToDelete(group);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Delete Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges / Stats */}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{groupMembers.length} Members</span>
                    </span>

                    {outstandingCount > 0 ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 text-[11px] font-semibold">
                        {outstandingCount} unsettled
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 text-[11px] font-semibold">
                        Settled
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer details */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Expense</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                      {formatCurrency(totalSpending, currency)}
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Create New Group
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter a name and optional description.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Shared expenses for our weekend getaway"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Edit Group
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Update name or description.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Group Modal with security code 100 */}
      {groupToDelete && (
        <ConfirmDeleteModal
          isOpen={!!groupToDelete}
          title="Delete Expense Group"
          description={`Are you sure you want to permanently delete the group "${groupToDelete.name}" along with all its members, transactions, and split records? This cannot be undone.`}
          requiredConfirmation="100"
          confirmButtonText="Delete Entire Group"
          onConfirm={async () => {
            if (groupToDelete) {
              await onDeleteGroup(groupToDelete.id);
              onToast('success', `Group "${groupToDelete.name}" deleted.`);
              setGroupToDelete(null);
            }
          }}
          onCancel={() => setGroupToDelete(null)}
        />
      )}
    </div>
  );
};

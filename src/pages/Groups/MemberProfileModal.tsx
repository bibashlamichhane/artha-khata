import React, { useState } from 'react';
import { X, User, Phone, ArrowUpRight, ArrowDownLeft, Edit2, Check, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/settlement';
import type { GroupMember, MemberBalance, DebtSettlement } from '@/types/khata';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: GroupMember;
  balance?: MemberBalance;
  settlements: DebtSettlement[];
  currency: string;
  onUpdateMember: (id: string, name: string, phone?: string, photo_url?: string) => Promise<void>;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  isOpen,
  onClose,
  member,
  balance,
  settlements,
  currency,
  onUpdateMember,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone || '');
  const [photoUrl, setPhotoUrl] = useState(member.photo_url || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const netBalance = balance?.net_balance || 0;
  const isCreditor = netBalance > 0;
  const isDebtor = netBalance < 0;

  // Person-to-person settlement details for this specific member
  const debtsToPay = settlements.filter((s) => s.from_id === member.id);
  const debtsToReceive = settlements.filter((s) => s.to_id === member.id);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateMember(member.id, name.trim(), phone.trim() || undefined, photoUrl.trim() || undefined);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Done'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Avatar and Main Info */}
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center text-slate-900 dark:text-white shadow-xl overflow-hidden mb-4 relative">
              {photoUrl ? (
                <img src={photoUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {!isEditing ? (
              <>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {member.name}
                </h3>
                {member.phone && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{member.phone}</span>
                  </p>
                )}
              </>
            ) : (
              <div className="w-full space-y-3 mt-2 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Member Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+977 98..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Net Balance & Settlement Status Card */}
          <div
            className={`p-5 rounded-2xl border ${
              isCreditor
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                : isDebtor
                ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Net Balance
                </p>
                <p
                  className={`text-2xl font-bold tracking-tight mt-1 ${
                    isCreditor
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isDebtor
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatCurrency(netBalance, currency, true)}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    isCreditor
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                      : isDebtor
                      ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isCreditor
                    ? 'Should Receive'
                    : isDebtor
                    ? 'Needs to Pay'
                    : 'All Settled'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Total Paid</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                  {formatCurrency(balance?.total_paid || 0, currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Total Share</span>
                <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                  {formatCurrency(balance?.total_share || 0, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Person-to-Person Settlement Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Person-to-Person Settlement Breakdown
            </h4>

            {debtsToPay.length === 0 && debtsToReceive.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">
                No active outstanding debts for this member.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Needs to Pay */}
                {debtsToPay.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">
                        Owes <strong>{d.to_name}</strong>
                      </span>
                    </div>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {d.formatted_amount}
                    </span>
                  </div>
                ))}

                {/* Should Receive */}
                {debtsToReceive.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">
                        To receive from <strong>{d.from_name}</strong>
                      </span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {d.formatted_amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

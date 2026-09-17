import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  Receipt,
  Users,
} from 'lucide-react';
import { formatCurrency, sortTransactionsNewestFirst } from '@/lib/settlement';
import { generatePDFReport } from '@/lib/pdf';
import type {
  ExpenseTransaction,
  ExpenseGroup,
  GroupMember,
  UserSettings,
  DateFilterType,
} from '@/types/khata';

interface ReportsPageProps {
  transactions: ExpenseTransaction[];
  groups: ExpenseGroup[];
  members: GroupMember[];
  settings?: UserSettings | null;
  currency: string;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  transactions,
  groups,
  members,
  settings,
  currency,
  onToast,
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedPayerId, setSelectedPayerId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const memberMap = new Map<string, GroupMember>();
  for (const m of members) memberMap.set(m.id, m);

  const groupMap = new Map<string, ExpenseGroup>();
  for (const g of groups) groupMap.set(g.id, g);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();

    const matches = transactions.filter((tx) => {
      const txDate = new Date(tx.transaction_date);

      // Group filter
      if (selectedGroupId !== 'all' && tx.group_id !== selectedGroupId) {
        return false;
      }

      // Payer filter
      if (selectedPayerId !== 'all' && tx.paid_by !== selectedPayerId) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        return txDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'this_week') {
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - now.getDay());
        firstDayOfWeek.setHours(0, 0, 0, 0);
        return txDate >= firstDayOfWeek;
      }
      if (dateFilter === 'this_month') {
        return (
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      }
      if (dateFilter === 'custom') {
        if (customStartDate && txDate < new Date(customStartDate)) return false;
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }
      return true;
    });

    return sortTransactionsNewestFirst(matches);
  }, [transactions, dateFilter, customStartDate, customEndDate, selectedPayerId, selectedGroupId]);

  const totalFilteredAmountMinor = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  const dateFilterLabels: Record<DateFilterType, string> = {
    all: 'All Time',
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    custom: customStartDate || customEndDate ? `${customStartDate || 'Start'} to ${customEndDate || 'Now'}` : 'Custom Range',
  };

  const payerFilterLabel =
    selectedPayerId === 'all'
      ? 'All Members'
      : memberMap.get(selectedPayerId)?.name || 'Selected Member';

  const handleDownloadPDF = () => {
    if (filteredTransactions.length === 0) {
      onToast('info', 'No transactions found matching the current filters.');
      return;
    }

    try {
      generatePDFReport({
        transactions: filteredTransactions,
        groups,
        members,
        settings,
        dateFilterLabel: dateFilterLabels[dateFilter],
        payerFilterLabel,
        currency,
      });
      onToast('success', 'PDF statement downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      onToast('error', 'Failed to generate PDF report.');
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Expense Reports</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Audit Ready
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Filter, inspect, and export financial statements with bank-grade styling.
          </p>
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={filteredTransactions.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF Report</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Report Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Time Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Group Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Group Filter
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Paid By Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Paid By Member
            </label>
            <select
              value={selectedPayerId}
              onChange={(e) => setSelectedPayerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Payers</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({groupMap.get(m.group_id)?.name || 'Group'})
                </option>
              ))}
            </select>
          </div>

          {/* Total Box */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Filtered Total
            </span>
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(totalFilteredAmountMinor, currency)}
            </span>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Transactions Report Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Statement Entries ({filteredTransactions.length})
            </h3>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
            Total: {formatCurrency(totalFilteredAmountMinor, currency)}
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No transactions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">S.N.</th>
                  <th className="py-3 px-4">Transaction</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4">Split With</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {filteredTransactions.map((tx, idx) => {
                  const payer = memberMap.get(tx.paid_by);
                  const group = groupMap.get(tx.group_id);
                  const txDate = new Date(tx.transaction_date);

                  const splitNames = (tx.splits || [])
                    .map((s) => memberMap.get(s.member_id)?.name || 'Member')
                    .join(', ');

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {tx.description}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {group?.name || 'Group'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(tx.amount, currency)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {payer?.name || 'Member'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500 dark:text-slate-400" title={splitNames}>
                        {splitNames || 'All Members'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                        {txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                        <span className="text-[10px] text-slate-400">
                          {txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

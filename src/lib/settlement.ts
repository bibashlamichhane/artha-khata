import type {
  ExpenseTransaction,
  GroupMember,
  MemberBalance,
  DebtSettlement,
  GroupSettlementSummary,
} from '@/types/khata';

/**
 * Converts a decimal amount (e.g. 1500.50) into integer minor units (150050 paisa/cents)
 */
export function toMinorUnits(amount: number | string): number {
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount.trim());
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  }
  return Math.round(amount * 100);
}

/**
 * Converts integer minor units back to a decimal number
 */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/**
 * Formats a minor-unit integer into a standard currency string (e.g. "NPR 1,500.00")
 */
export function formatCurrency(
  minorAmount: number,
  currency: string = 'NPR',
  showSign: boolean = false
): string {
  const isNegative = minorAmount < 0;
  const absMajor = Math.abs(minorAmount) / 100;
  const formattedNumber = absMajor.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (showSign) {
    if (isNegative) {
      return `-${currency} ${formattedNumber}`;
    }
    if (minorAmount > 0) {
      return `+${currency} ${formattedNumber}`;
    }
  }

  return isNegative ? `-${currency} ${formattedNumber}` : `${currency} ${formattedNumber}`;
}

/**
 * Calculate equal split share for an amount across participants
 * Returns an array of minor units per participant that sum to exactly the total amount
 * (distributing any remainder 1-paisa division evenly to avoid 1-paisa loss)
 */
export function calculateEqualSplits(
  totalAmountMinor: number,
  participantIds: string[]
): { member_id: string; share_amount: number }[] {
  const n = participantIds.length;
  if (n === 0) return [];

  const baseShare = Math.floor(totalAmountMinor / n);
  const remainder = totalAmountMinor % n;

  return participantIds.map((id, index) => ({
    member_id: id,
    // Add 1 minor unit to the first `remainder` participants to ensure exact sum match
    share_amount: baseShare + (index < remainder ? 1 : 0),
  }));
}

/**
 * Calculates net balances and optimal settlement transactions for a group
 */
export function calculateGroupSettlement(
  members: GroupMember[],
  transactions: ExpenseTransaction[],
  groupId: string = '',
  currency: string = 'NPR'
): GroupSettlementSummary {
  const memberMap = new Map<string, GroupMember>();
  for (const m of members) {
    memberMap.set(m.id, m);
  }

  // Initialize balances map
  const balances: Record<string, MemberBalance> = {};
  for (const m of members) {
    balances[m.id] = {
      member_id: m.id,
      name: m.name,
      phone: m.phone,
      photo_url: m.photo_url,
      total_paid: 0,
      total_share: 0,
      net_balance: 0,
    };
  }

  let totalSpending = 0;

  // Process all transactions
  for (const tx of transactions) {
    totalSpending += tx.amount;

    // Credit the payer
    if (balances[tx.paid_by]) {
      balances[tx.paid_by].total_paid += tx.amount;
    }

    // Debit the participants
    if (tx.splits && tx.splits.length > 0) {
      for (const split of tx.splits) {
        if (balances[split.member_id]) {
          balances[split.member_id].total_share += split.share_amount;
        }
      }
    }
  }

  // Compute net balance = total_paid - total_share
  for (const id of Object.keys(balances)) {
    balances[id].net_balance = balances[id].total_paid - balances[id].total_share;
  }

  // Calculate debt settlements (who owes whom) using Greedy Settlement Algorithm
  const debtors: { id: string; name: string; amount: number }[] = [];
  const creditors: { id: string; name: string; amount: number }[] = [];

  for (const b of Object.values(balances)) {
    if (b.net_balance < -0) {
      debtors.push({ id: b.member_id, name: b.name, amount: -b.net_balance });
    } else if (b.net_balance > 0) {
      creditors.push({ id: b.member_id, name: b.name, amount: b.net_balance });
    }
  }

  // Sort descending to optimize matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: DebtSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0) {
      settlements.push({
        id: `${debtor.id}_to_${creditor.id}_${settledAmount}`,
        from_id: debtor.id,
        from_name: debtor.name,
        to_id: creditor.id,
        to_name: creditor.name,
        amount: settledAmount,
        formatted_amount: formatCurrency(settledAmount, currency),
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount === 0) dIdx++;
    if (creditor.amount === 0) cIdx++;
  }

  // Generate dynamic rotating settlement messages
  const rotating_messages: string[] = [];
  if (settlements.length === 0) {
    rotating_messages.push('All group balances are settled!');
  } else {
    for (const s of settlements) {
      rotating_messages.push(`${s.from_name} owes ${s.to_name} ${s.formatted_amount}`);
    }
  }

  return {
    group_id: groupId,
    total_spending: totalSpending,
    balances,
    settlements,
    rotating_messages,
  };
}

/**
 * Calculates person-to-person settlement details specifically for one member
 */
export function getMemberSettlementDetails(
  memberId: string,
  settlements: DebtSettlement[]
): {
  needsToPay: DebtSettlement[];
  shouldReceive: DebtSettlement[];
  totalToPay: number;
  totalToReceive: number;
} {
  const needsToPay = settlements.filter((s) => s.from_id === memberId);
  const shouldReceive = settlements.filter((s) => s.to_id === memberId);

  const totalToPay = needsToPay.reduce((acc, curr) => acc + curr.amount, 0);
  const totalToReceive = shouldReceive.reduce((acc, curr) => acc + curr.amount, 0);

  return {
    needsToPay,
    shouldReceive,
    totalToPay,
    totalToReceive,
  };
}

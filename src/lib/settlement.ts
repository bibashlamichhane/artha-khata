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

/**
 * Sorts transactions deterministically newest first (NEW -> OLDER -> OLDEST)
 * Uses transaction_date primary, created_at secondary, and id tertiary.
 */
export function sortTransactionsNewestFirst(
  transactions: ExpenseTransaction[]
): ExpenseTransaction[] {
  return [...transactions].sort((a, b) => {
    const timeA = new Date(a.transaction_date || a.created_at || 0).getTime();
    const timeB = new Date(b.transaction_date || b.created_at || 0).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    if (createdB !== createdA) {
      return createdB - createdA;
    }
    return (b.id || '').localeCompare(a.id || '');
  });
}

export interface MemberWiseSettlementItem {
  member: GroupMember;
  amount: number; // in minor units
  status: 'receive' | 'pay' | 'settled';
  formatted_amount: string;
}

/**
 * Calculates member-wise settlement breakdown for an individual member.
 * Guarantees that ALL OTHER members in the group are returned (never excluding zero-balance members).
 * Never includes the member itself against itself.
 */
export function getMemberWiseSettlements(
  memberId: string,
  allGroupMembers: GroupMember[],
  settlements: DebtSettlement[] = [],
  transactions: ExpenseTransaction[] = [],
  memberBalances: Record<string, MemberBalance> = {},
  currency: string = 'NPR'
): MemberWiseSettlementItem[] {
  const otherMembers = allGroupMembers.filter((m) => m.id !== memberId);
  const currentMemberBalance = memberBalances[memberId];
  const currentNet = currentMemberBalance?.net_balance || 0;

  return otherMembers.map((other) => {
    // 1. Check if there is a simplified settlement debt directly between memberId and other.id
    const toReceive = settlements.find(
      (s) => s.from_id === other.id && s.to_id === memberId
    );
    const toPay = settlements.find(
      (s) => s.from_id === memberId && s.to_id === other.id
    );

    if (toReceive && toReceive.amount > 0) {
      return {
        member: other,
        amount: toReceive.amount,
        status: 'receive',
        formatted_amount: formatCurrency(toReceive.amount, currency),
      };
    }

    if (toPay && toPay.amount > 0) {
      return {
        member: other,
        amount: toPay.amount,
        status: 'pay',
        formatted_amount: formatCurrency(toPay.amount, currency),
      };
    }

    // 2. If not matched in simplified settlements, calculate direct pairwise splits from transactions
    let paidByMemberForOther = 0;
    let paidByOtherForMember = 0;

    for (const tx of transactions) {
      if (tx.paid_by === memberId) {
        const split = tx.splits?.find((s) => s.member_id === other.id);
        if (split) paidByMemberForOther += split.share_amount;
      } else if (tx.paid_by === other.id) {
        const split = tx.splits?.find((s) => s.member_id === memberId);
        if (split) paidByOtherForMember += split.share_amount;
      }
    }

    const directNet = paidByMemberForOther - paidByOtherForMember;
    const otherMemberBalance = memberBalances[other.id];
    const otherNet = otherMemberBalance?.net_balance || 0;

    // Verify alignment with overall balances
    if (directNet > 0 && currentNet > 0 && otherNet < 0) {
      const amt = Math.min(directNet, currentNet, Math.abs(otherNet));
      if (amt > 0) {
        return {
          member: other,
          amount: amt,
          status: 'receive',
          formatted_amount: formatCurrency(amt, currency),
        };
      }
    } else if (directNet < 0 && currentNet < 0 && otherNet > 0) {
      const amt = Math.min(Math.abs(directNet), Math.abs(currentNet), otherNet);
      if (amt > 0) {
        return {
          member: other,
          amount: amt,
          status: 'pay',
          formatted_amount: formatCurrency(amt, currency),
        };
      }
    }

    // 3. Otherwise, zero balance / all settled
    return {
      member: other,
      amount: 0,
      status: 'settled',
      formatted_amount: formatCurrency(0, currency),
    };
  });
}

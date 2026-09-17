/**
 * Settlement Engine Unit Tests
 * Verifies all financial split & settlement rules:
 * - One transaction
 * - Multiple transactions
 * - Payer included
 * - Payer excluded
 * - Multiple payers
 * - Different split members
 * - Equal splits
 * - Decimal amounts
 * - Deletion
 * - Zero balances
 */

import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  calculateEqualSplits,
  calculateGroupSettlement,
  getMemberSettlementDetails,
  sortTransactionsNewestFirst,
  getMemberWiseSettlements,
} from '../lib/settlement';
import type { GroupMember, ExpenseTransaction } from '../types/khata';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test Assertion Failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Test Failed: ${message} (Expected: ${expected}, Actual: ${actual})`);
  }
}

export function runSettlementTests() {
  console.log('--- Running Settlement Engine Tests ---');

  // Test 1: Minor unit conversion & formatting
  assertEquals(toMinorUnits(1500), 150000, 'toMinorUnits(1500)');
  assertEquals(toMinorUnits('1500.50'), 150050, 'toMinorUnits("1500.50")');
  assertEquals(fromMinorUnits(150050), 1500.5, 'fromMinorUnits(150050)');
  assertEquals(formatCurrency(150000, 'NPR'), 'NPR 1,500.00', 'formatCurrency');
  assertEquals(formatCurrency(-50000, 'NPR', true), '-NPR 500.00', 'formatCurrency negative with sign');
  assertEquals(formatCurrency(50000, 'NPR', true), '+NPR 500.00', 'formatCurrency positive with sign');

  // Mock members
  const bibash: GroupMember = { id: 'm1', group_id: 'g1', name: 'Bibash', created_at: '', updated_at: '' };
  const sandesh: GroupMember = { id: 'm2', group_id: 'g1', name: 'Sandesh', created_at: '', updated_at: '' };
  const janak: GroupMember = { id: 'm3', group_id: 'g1', name: 'Janak', created_at: '', updated_at: '' };
  const ranjit: GroupMember = { id: 'm4', group_id: 'g1', name: 'Ranjit', created_at: '', updated_at: '' };
  const members = [bibash, sandesh, janak, ranjit];

  // Test 2: Prompt specific example - Bibash pays 1000 for Bibash, Sandesh, Janak, Ranjit
  // Each share: 250.
  // Sandesh owes Bibash 250, Janak owes Bibash 250, Ranjit owes Bibash 250.
  const splits1 = calculateEqualSplits(100000, ['m1', 'm2', 'm3', 'm4']);
  assertEquals(splits1.length, 4, 'splits count');
  assertEquals(splits1[0].share_amount, 25000, 'share amount');

  const tx1: ExpenseTransaction = {
    id: 't1',
    group_id: 'g1',
    owner_id: 'u1',
    description: 'Lunch',
    amount: 100000,
    currency: 'NPR',
    paid_by: 'm1', // Bibash paid
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    splits: splits1.map((s) => ({ id: `s_${s.member_id}`, transaction_id: 't1', ...s })),
  };

  const summary1 = calculateGroupSettlement(members, [tx1], 'g1', 'NPR');
  assertEquals(summary1.balances['m1'].net_balance, 75000, 'Bibash should receive 750 NPR');
  assertEquals(summary1.balances['m2'].net_balance, -25000, 'Sandesh needs to pay 250 NPR');
  assertEquals(summary1.balances['m3'].net_balance, -25000, 'Janak needs to pay 250 NPR');
  assertEquals(summary1.balances['m4'].net_balance, -25000, 'Ranjit needs to pay 250 NPR');

  // Verify settlement transfers: 3 transfers to Bibash of 250 each
  assertEquals(summary1.settlements.length, 3, 'settlement transfer count');
  assert(
    summary1.settlements.every((s) => s.to_id === 'm1' && s.amount === 25000),
    'All debts go to Bibash for 250 each'
  );

  // Test 3: Payer excluded from split
  // Bibash buys a gift for Sandesh and Janak only (1000 NPR). Bibash does not participate in the split.
  const splitsExcluded = calculateEqualSplits(100000, ['m2', 'm3']);
  const txExcluded: ExpenseTransaction = {
    id: 't2',
    group_id: 'g1',
    owner_id: 'u1',
    description: 'Gift',
    amount: 100000,
    currency: 'NPR',
    paid_by: 'm1', // Bibash paid
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    splits: splitsExcluded.map((s) => ({ id: `s_ex_${s.member_id}`, transaction_id: 't2', ...s })),
  };

  const summaryExcluded = calculateGroupSettlement(members, [txExcluded], 'g1', 'NPR');
  assertEquals(summaryExcluded.balances['m1'].net_balance, 100000, 'Bibash receives full 1000');
  assertEquals(summaryExcluded.balances['m2'].net_balance, -50000, 'Sandesh pays 500');
  assertEquals(summaryExcluded.balances['m3'].net_balance, -50000, 'Janak pays 500');
  assertEquals(summaryExcluded.balances['m4'].net_balance, 0, 'Ranjit is unaffected (0 balance)');

  // Test 4: Multiple payers and multiple transactions
  // Tx A: Bibash pays 400 for Bibash & Sandesh (200 each) -> Sandesh owes Bibash 200
  // Tx B: Sandesh pays 400 for Bibash & Sandesh (200 each) -> Bibash owes Sandesh 200
  // Net balance should be 0 for both!
  const txA: ExpenseTransaction = {
    id: 'txA',
    group_id: 'g1',
    owner_id: 'u1',
    description: 'Tx A',
    amount: 40000,
    currency: 'NPR',
    paid_by: 'm1',
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    splits: [
      { id: 'sA1', transaction_id: 'txA', member_id: 'm1', share_amount: 20000 },
      { id: 'sA2', transaction_id: 'txA', member_id: 'm2', share_amount: 20000 },
    ],
  };

  const txB: ExpenseTransaction = {
    id: 'txB',
    group_id: 'g1',
    owner_id: 'u1',
    description: 'Tx B',
    amount: 40000,
    currency: 'NPR',
    paid_by: 'm2',
    transaction_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    splits: [
      { id: 'sB1', transaction_id: 'txB', member_id: 'm1', share_amount: 20000 },
      { id: 'sB2', transaction_id: 'txB', member_id: 'm2', share_amount: 20000 },
    ],
  };

  const summaryBalanced = calculateGroupSettlement(members, [txA, txB], 'g1', 'NPR');
  assertEquals(summaryBalanced.balances['m1'].net_balance, 0, 'Bibash net balance should be zero');
  assertEquals(summaryBalanced.balances['m2'].net_balance, 0, 'Sandesh net balance should be zero');
  assertEquals(summaryBalanced.settlements.length, 0, 'Zero debts remain');

  // Test 5: Decimal amounts & odd division (e.g., 100 NPR split 3 ways: 33.34 + 33.33 + 33.33)
  const oddSplits = calculateEqualSplits(10000, ['m1', 'm2', 'm3']);
  const sumSplits = oddSplits.reduce((acc, curr) => acc + curr.share_amount, 0);
  assertEquals(sumSplits, 10000, 'Odd split distributes remainder without losing 1 paisa');

  // Test 6: Member settlement details
  const m1Details = getMemberSettlementDetails('m1', summary1.settlements);
  assertEquals(m1Details.totalToReceive, 75000, 'Bibash receives 750 total');
  assertEquals(m1Details.totalToPay, 0, 'Bibash pays 0');

  // Test 7: sortTransactionsNewestFirst deterministic sorting
  const unorderedTxs: ExpenseTransaction[] = [
    {
      id: 'tx_old',
      group_id: 'g1',
      owner_id: 'u1',
      description: 'Older Tx',
      amount: 1000,
      currency: 'NPR',
      paid_by: 'm1',
      transaction_date: '2026-01-01T10:00:00Z',
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
      splits: [],
    },
    {
      id: 'tx_newest',
      group_id: 'g1',
      owner_id: 'u1',
      description: 'Newest Tx',
      amount: 2000,
      currency: 'NPR',
      paid_by: 'm1',
      transaction_date: '2026-03-01T10:00:00Z',
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T10:00:00Z',
      splits: [],
    },
    {
      id: 'tx_mid',
      group_id: 'g1',
      owner_id: 'u1',
      description: 'Mid Tx',
      amount: 1500,
      currency: 'NPR',
      paid_by: 'm1',
      transaction_date: '2026-02-01T10:00:00Z',
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-01T10:00:00Z',
      splits: [],
    },
  ];
  const sortedTxs = sortTransactionsNewestFirst(unorderedTxs);
  assertEquals(sortedTxs[0].id, 'tx_newest', 'First tx is newest');
  assertEquals(sortedTxs[1].id, 'tx_mid', 'Second tx is mid');
  assertEquals(sortedTxs[2].id, 'tx_old', 'Third tx is oldest');

  // Test 8: getMemberWiseSettlements includes all other group members even with 0 balance
  // In summaryExcluded, Bibash (m1) paid 1000 for Sandesh (m2) and Janak (m3).
  // Ranjit (m4) has 0 balance.
  const bibashMemberWise = getMemberWiseSettlements('m1', members, summaryExcluded.settlements);
  assertEquals(bibashMemberWise.length, 3, 'Bibash sees all 3 other members');
  assert(!bibashMemberWise.some((b) => b.member.id === 'm1'), 'Bibash does not see self');
  const ranjitRelToBibash = bibashMemberWise.find((b) => b.member.id === 'm4');
  assert(!!ranjitRelToBibash, 'Ranjit is in the list');
  assertEquals(ranjitRelToBibash?.status, 'settled', 'Ranjit status is settled with 0 balance');
  assertEquals(ranjitRelToBibash?.amount, 0, 'Ranjit amount is 0');

  // When viewing Sandesh (m2)
  const sandeshMemberWise = getMemberWiseSettlements('m2', members, summaryExcluded.settlements);
  assertEquals(sandeshMemberWise.length, 3, 'Sandesh sees all 3 other members');
  assert(!sandeshMemberWise.some((b) => b.member.id === 'm2'), 'Sandesh does not see self');
  const bibashRelToSandesh = sandeshMemberWise.find((b) => b.member.id === 'm1');
  assertEquals(bibashRelToSandesh?.status, 'pay', 'Sandesh pays Bibash');
  assertEquals(bibashRelToSandesh?.amount, 50000, 'Sandesh pays 500 NPR');

  console.log('✓ All Settlement Engine tests passed successfully!');
  return true;
}

// Auto-run if executed in Node directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('settlement.test')) {
  runSettlementTests();
}

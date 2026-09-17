import { formatCurrency, fromMinorUnits } from './settlement';
import type { ExpenseTransaction, GroupMember, ExpenseGroup, UserSettings } from '@/types/khata';

export interface BillReceiptData {
  transaction: ExpenseTransaction;
  group: ExpenseGroup;
  paidByMember: GroupMember;
  splitMembers: { member: GroupMember; share_amount: number }[];
  settings?: UserSettings | null;
}

/**
 * Generates a crisp, high-resolution PNG receipt image using HTML5 Canvas
 * and automatically triggers download for the user.
 */
export async function generateAndDownloadBill(data: BillReceiptData): Promise<string> {
  const { transaction, group, paidByMember, splitMembers, settings } = data;

  const companyName = settings?.company_name || 'KHATA FINANCIALS';
  const currency = transaction.currency || settings?.currency || 'NPR';
  const txDate = new Date(transaction.transaction_date);

  const formattedDate = txDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = txDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Canvas dimensions (2x scale for Retina sharpness)
  const scale = 2;
  const width = 480 * scale;
  const baseHeight = (540 + splitMembers.length * 36) * scale;
  const height = baseHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Top header accent band
  ctx.fillStyle = '#0f172a'; // Navy Slate 900
  ctx.fillRect(0, 0, width, 24 * scale);

  // Decorative receipt zigzag top
  ctx.fillStyle = '#0f172a';
  for (let x = 0; x < width; x += 16 * scale) {
    ctx.beginPath();
    ctx.moveTo(x, 24 * scale);
    ctx.lineTo(x + 8 * scale, 32 * scale);
    ctx.lineTo(x + 16 * scale, 24 * scale);
    ctx.fill();
  }

  let y = 60 * scale;

  // Company Name
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(companyName.toUpperCase(), width / 2, y);

  y += 20 * scale;
  ctx.fillStyle = '#64748b';
  ctx.font = `600 ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('EXPENSE RECEIPT & SETTLEMENT SLIP', width / 2, y);

  y += 18 * scale;
  ctx.fillStyle = '#059669'; // Emerald
  ctx.font = `700 ${10 * scale}px monospace`;
  ctx.fillText(`RECEIPT NO: KHT-${transaction.id.substring(0, 8).toUpperCase()}`, width / 2, y);

  y += 24 * scale;

  // Dashed separator line
  function drawDashedLine(currentY: number) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5 * scale;
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.moveTo(32 * scale, currentY);
    ctx.lineTo(width - 32 * scale, currentY);
    ctx.stroke();
    ctx.restore();
  }

  drawDashedLine(y);
  y += 28 * scale;

  // Big Amount Box
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(32 * scale, y, width - 64 * scale, 68 * scale, 12 * scale);
  ctx.fill();

  ctx.fillStyle = '#64748b';
  ctx.font = `500 ${12 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL TRANSACTION AMOUNT', width / 2, y + 24 * scale);

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${24 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(formatCurrency(transaction.amount, currency), width / 2, y + 54 * scale);

  y += 92 * scale;

  // Key-Value Details Row Helper
  function drawRow(label: string, value: string, isBold: boolean = false, highlightColor?: string) {
    if (!ctx) return;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 ${13 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(label, 36 * scale, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = highlightColor || (isBold ? '#0f172a' : '#334155');
    ctx.font = `${isBold ? 'bold' : '600'} ${13 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(value, width - 36 * scale, y);
    y += 24 * scale;
  }

  drawRow('Expense Description', transaction.description, true);
  drawRow('Expense Group', group.name, false);
  drawRow('Paid By', paidByMember.name, true, '#059669');
  drawRow('Date', formattedDate, false);
  drawRow('Time', formattedTime, false);

  y += 10 * scale;
  drawDashedLine(y);
  y += 28 * scale;

  // Split Breakdown Header
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText('SPLIT DISTRIBUTION', 36 * scale, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = `600 ${12 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(`${splitMembers.length} Participant${splitMembers.length > 1 ? 's' : ''}`, width - 36 * scale, y);

  y += 24 * scale;

  // Split items
  splitMembers.forEach((item, index) => {
    if (!ctx) return;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `500 ${13 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
    const isPayer = item.member.id === paidByMember.id;
    const label = `${index + 1}. ${item.member.name} ${isPayer ? '(Payer)' : ''}`;
    ctx.fillText(label, 40 * scale, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 ${13 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(formatCurrency(item.share_amount, currency), width - 36 * scale, y);
    y += 24 * scale;
  });

  y += 14 * scale;
  drawDashedLine(y);
  y += 32 * scale;

  // Minimal Barcode Graphic
  ctx.save();
  ctx.fillStyle = '#1e293b';
  const barcodeWidth = width - 120 * scale;
  const startX = 60 * scale;
  const barHeight = 28 * scale;
  // Pseudorandom static bar pattern based on transaction ID
  for (let i = 0; i < barcodeWidth; i += 6 * scale) {
    const charCode = transaction.id.charCodeAt((i / 6) % transaction.id.length) || 48;
    const barW = (charCode % 3 + 1) * scale;
    ctx.fillRect(startX + i, y, barW, barHeight);
  }
  ctx.restore();

  y += barHeight + 18 * scale;

  // Footer branding
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 ${10 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Powered by KHATA — Group Expense & Settlement Management', width / 2, y);

  const dataUrl = canvas.toDataURL('image/png');

  // Trigger browser download
  const link = document.createElement('a');
  link.download = `KHATA_Bill_${transaction.description.replace(/\s+/g, '_')}_${transaction.id.slice(0, 6)}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return dataUrl;
}

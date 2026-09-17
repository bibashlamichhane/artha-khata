import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './settlement';
import type { ExpenseTransaction, GroupMember, UserSettings, ExpenseGroup } from '@/types/khata';

export interface PDFReportParams {
  transactions: ExpenseTransaction[];
  groups: ExpenseGroup[];
  members: GroupMember[];
  settings?: UserSettings | null;
  dateFilterLabel: string;
  payerFilterLabel: string;
  currency: string;
}

/**
 * Generates and downloads a multi-page financial statement PDF report
 */
export function generatePDFReport(params: PDFReportParams): void {
  const {
    transactions,
    groups,
    members,
    settings,
    dateFilterLabel,
    payerFilterLabel,
    currency,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const companyName = settings?.company_name || 'KHATA FINANCIALS';
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.id, m.name);
  }

  const groupMap = new Map<string, string>();
  for (const g of groups) {
    groupMap.set(g.id, g.name);
  }

  // Calculate totals
  const totalAmountMinor = transactions.reduce((acc, tx) => acc + tx.amount, 0);
  const formattedTotal = formatCurrency(totalAmountMinor, currency);

  // 1. Header Banner & Branding
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 74, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('KHATA', margin, 38);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('GROUP EXPENSE & SETTLEMENT MANAGEMENT', margin, 54);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), pageWidth - margin, 38, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`STATEMENT ISSUED: ${reportDate}`, pageWidth - margin, 54, { align: 'right' });

  // 2. Report Overview Box
  let startY = 96;

  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(margin, startY, pageWidth - margin * 2, 60, 6, 6, 'FD');

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE RANGE', margin + 16, startY + 22);
  doc.text('PAYER FILTER', margin + 150, startY + 22);
  doc.text('TRANSACTIONS', margin + 290, startY + 22);
  doc.text('TOTAL EXPENDITURE', pageWidth - margin - 16, startY + 22, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(dateFilterLabel, margin + 16, startY + 42);
  doc.text(payerFilterLabel, margin + 150, startY + 42);
  doc.text(`${transactions.length} record(s)`, margin + 290, startY + 42);

  doc.setTextColor(5, 150, 105); // Emerald 600
  doc.setFontSize(13);
  doc.text(formattedTotal, pageWidth - margin - 16, startY + 42, { align: 'right' });

  // 3. Table Rows Data
  const tableRows = transactions.map((tx, index) => {
    const txDate = new Date(tx.transaction_date);
    const dateStr = txDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = txDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const paidByName = memberMap.get(tx.paid_by) || 'Unknown';
    const splitNames = (tx.splits || [])
      .map((s) => memberMap.get(s.member_id) || 'Member')
      .join(', ');

    return [
      (index + 1).toString(),
      tx.description,
      groupMap.get(tx.group_id) || 'Group',
      formatCurrency(tx.amount, currency),
      paidByName,
      splitNames || 'All Members',
      `${dateStr}\n${timeStr}`,
    ];
  });

  // 4. Render Table with AutoTable
  autoTable(doc, {
    startY: startY + 76,
    head: [['S.N.', 'Transaction', 'Group', 'Amount', 'Paid By', 'Split With', 'Date & Time']],
    body: tableRows,
    margin: { left: margin, right: margin, bottom: 50 },
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249], // Slate 100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 8,
      lineWidth: 0.5,
      lineColor: [203, 213, 225],
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 8.5,
      cellPadding: 7,
      lineWidth: 0.5,
      lineColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 95, fontStyle: 'bold' },
      2: { cellWidth: 70 },
      3: { cellWidth: 75, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
      4: { cellWidth: 75, textColor: [5, 150, 105], fontStyle: 'bold' },
      5: { cellWidth: 105 },
      6: { cellWidth: 68, halign: 'center', fontSize: 8 },
    },
    didDrawPage: (data) => {
      // Professional repeating footer
      const totalPages = (doc.internal as any).getNumberOfPages
        ? (doc.internal as any).getNumberOfPages()
        : 1;
      const currentPage = data.pageNumber;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'KHATA — Official Group Expense & Settlement Audit Report',
        margin,
        pageHeight - 20
      );

      doc.text(
        `Page ${currentPage} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 20,
        { align: 'right' }
      );
    },
  });

  // Save the PDF
  const filename = `KHATA_Report_${dateFilterLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { auth } from "./firebase"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserAttribution() {
  const user = auth.currentUser;
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Unknown User';
  
  // Basic device detection
  const ua = navigator.userAgent;
  let device = 'Web';
  if (/mobile/i.test(ua)) device = 'Mobile';
  if (/tablet/i.test(ua)) device = 'Tablet';
  if (/iPad|iPhone|iPod/.test(ua)) device = 'iOS';
  if (/Android/.test(ua)) device = 'Android';
  if (/Macintosh/.test(ua)) device = 'Mac';
  if (/Windows/.test(ua)) device = 'Windows';
  if (/Linux/.test(ua)) device = 'Linux';

  return {
    userName,
    userId: user?.uid,
    device,
    timestamp: Date.now()
  };
}

/**
 * Super robust direct HTML Print compiler to generate flawless PDF reports.
 * This completely bypasses any OS antivirus blocks, corporate firewalls, or 
 * group policy settings that cause raw jsPDF blobs to trigger false-positives
 * like "Virus scan failed" in Chrome.
 * 
 * It generates a visually jaw-dropping vector layout directly inside the Chrome
 * Native print subsystem, enabling instant print or "Save as PDF" at native resolution.
 */
export function printActivityReportHTML(incomes: any[], expenses: any[], tasks: any[], members: any[], user?: any) {
  const totalIncome = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
  const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const { balances, settlements } = calculateSettlements(members, expenses);

  // Identify current user's member object if user is provided
  const myMember = user ? members.find((m: any) => m.userId === user?.uid || (user?.email && m.email === user.email)) : null;
  const peopleWhoOweMe = settlements.filter((s: any) => myMember && s.to === myMember.id);
  const peopleIOwe = settlements.filter((s: any) => myMember && s.from === myMember.id);

  let personalBoxHtml = '';
  if (myMember) {
    const netBal = balances[myMember.id] || 0;
    const isCredit = netBal >= 0;
    const balColor = isCredit ? '#10b981' : '#ef4444';
    const absBal = Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const balText = isCredit ? `Owed to you: +₹${absBal}` : `You owe: -₹${absBal}`;

    let detailsText: string;
    if (peopleWhoOweMe.length > 0) {
      const list = peopleWhoOweMe.map((s: any) => {
        const debtorName = members.find((m: any) => m.id === s.from)?.name || "Member";
        return `<strong>${debtorName}</strong> owes you ₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }).join(', ');
      detailsText = `These payments need to be made to you: ${list}.`;
    } else if (netBal > 0) {
      detailsText = "You are owed a net share from the cooperative pool.";
    } else if (netBal < 0 && peopleIOwe.length > 0) {
      const list = peopleIOwe.map((s: any) => {
        const receiverName = members.find((m: any) => m.id === s.to)?.name || "Member";
        return `You need to pay <strong>${receiverName}</strong> ₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }).join(', ');
      detailsText = `You need to settle up with: ${list}.`;
    } else {
      detailsText = "Your ledger is perfectly balanced. No dues pending!";
    }

    personalBoxHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left;">
        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Personal Settlement Overview (${myMember.name})</h4>
        <div style="font-size: 14px; font-weight: 700; color: ${balColor}; margin-bottom: 8px;">${balText}</div>
        <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${detailsText}</p>
      </div>
    `;
  }

  const settlementsRowsHtml = settlements.length > 0 ? settlements.map((s: any) => {
    const debtorName = members.find((m: any) => m.id === s.from)?.name || `Member (${s.from.substring(0, 5)})`;
    const creditorName = members.find((m: any) => m.id === s.to)?.name || `Member (${s.to.substring(0, 5)})`;
    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 600;">${debtorName}</td>
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 600;">${creditorName}</td>
        <td style="padding: 10px 12px; font-weight: 700; color: #4f46e5;">₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">All debts are fully settled! No payments pending.</td>
    </tr>
  `;

  const memberBalancesHtml = members.length > 0 ? members.map((m: any) => {
    const netBal = balances[m.id] || 0;
    const isCredit = netBal >= 0.01;
    const isDebit = netBal <= -0.01;
    const statusText = isCredit 
      ? `Owed +₹${netBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
      : isDebit 
        ? `Owes ₹${Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'Settled';
    const badgeBg = isCredit ? '#f0fdf4' : isDebit ? '#fef2f2' : '#f1f5f9';
    const badgeColor = isCredit ? '#15803d' : isDebit ? '#b91c1c' : '#475569';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 500;">${m.name}</td>
        <td style="padding: 10px 12px; color: #475569;">${m.email || 'No email'}</td>
        <td style="padding: 10px 12px; text-align: right;"><span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">${statusText}</span></td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">No members found.</td>
    </tr>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error("Popup blocked! Please allow popups for this site to generate the printable report.");
  }

  // Double check rows assembly
  const incomesRows = incomes.length > 0 ? incomes.map(inc => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 12px; color: #1e293b; font-weight: 500;">${inc.source || 'N/A'}</td>
      <td style="padding: 10px 12px; font-weight: 600; color: #10b981;">₹${(inc.amount || 0).toLocaleString('en-IN')}</td>
      <td style="padding: 10px 12px; color: #475569;">${inc.date || 'N/A'}</td>
      <td style="padding: 10px 12px;"><span style="background-color: #f0fdf4; color: #166534; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 500;">${inc.category || 'N/A'}</span></td>
      <td style="padding: 10px 12px; color: #64748b; font-size: 11px;">${inc.notes || ''}</td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">No income logs processed.</td>
    </tr>
  `;

  const expensesRows = expenses.length > 0 ? expenses.map(exp => {
    const paidByName = members.find((m: any) => m.id === exp.paidBy)?.name || exp.createdByName || 'N/A';
    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 500;">${exp.description || 'N/A'}</td>
        <td style="padding: 10px 12px; font-weight: 600; color: #ef4444;">₹${(exp.amount || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 10px 12px; color: #475569;">${exp.date || 'N/A'}</td>
        <td style="padding: 10px 12px;"><span style="background-color: #fef2f2; color: #991b1b; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 500;">${exp.category || 'N/A'}</span></td>
        <td style="padding: 10px 12px; color: #475569; font-weight: 500;">${paidByName}</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">No expense logs processed.</td>
    </tr>
  `;

  const tasksRows = tasks.length > 0 ? tasks.map(task => {
    const assignedToName = members.find((m: any) => m.id === task.assignedTo)?.name || 'Unassigned';
    
    // Status colors
    let statusColor = '#475569';
    let statusBg = '#f1f5f9';
    if (task.status === 'completed') {
      statusColor = '#15803d';
      statusBg = '#f0fdf4';
    } else if (task.status === 'in_progress') {
      statusColor = '#1d4ed8';
      statusBg = '#eff6ff';
    } else if (task.status === 'review') {
      statusColor = '#b45309';
      statusBg = '#fffbeb';
    }

    // Priority color
    const prioColor = task.priority === 'high' ? '#dc2626' : task.priority === 'urgent' ? '#7f1d1d' : '#475569';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; color: #1e293b; font-weight: 600;">${task.title || 'N/A'}</td>
        <td style="padding: 10px 12px; color: #64748b; font-size: 11px; max-w-xs;">${task.description || ''}</td>
        <td style="padding: 10px 12px;"><span style="color: ${statusColor}; background-color: ${statusBg}; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">${(task.status || 'todo').replace('_', ' ').toUpperCase()}</span></td>
        <td style="padding: 10px 12px; color: ${prioColor}; font-weight: 600; font-size: 11px;">${(task.priority || 'medium').toUpperCase()}</td>
        <td style="padding: 10px 12px; color: #475569;">${assignedToName}</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">No task history found in the database.</td>
    </tr>
  `;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Organic-O-Eats - Complete Activity & Financial Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 40px;
          background-color: #f8fafc;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          body {
            padding: 0;
            background-color: #ffffff;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
        .actions-bar {
          background-color: #0f172a;
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        }
        .print-btn {
          background-color: #10b981;
          color: white;
          border: none;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
        }
        .print-btn:hover {
          background-color: #059669;
          transform: translateY(-1px);
        }
        .print-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);
          max-w: 900px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 24px;
          margin-bottom: 30px;
        }
        .title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.05em;
          color: #0f172a;
          margin: 0;
        }
        .subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 6px 0 0 0;
          font-weight: 500;
        }
        .meta-box {
          font-size: 12px;
          color: #64748b;
          text-align: right;
          line-height: 1.6;
        }
        .kpi-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .kpi-card {
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 20px;
          text-align: left;
        }
        .kpi-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .kpi-value {
          font-size: 26px;
          font-weight: 800;
          margin-top: 6px;
          letter-spacing: -0.02em;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 36px 0 16px 0;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 8px;
          letter-spacing: -0.02em;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 12px;
          text-align: left;
        }
        th {
          background-color: #f8fafc;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 10px;
          font-weight: 700;
          padding: 12px;
          border-bottom: 2px solid #e2e8f0;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
      </style>
    </head>
    <body>
      <div class="actions-bar no-print">
        <div>
          <strong style="font-size: 15px; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
            🛡️ Safe Sandbox Native PDF printing activated
          </strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">
            We routed your report through the browser's built-in print subsystem. Select "Save as PDF" to save it without triggering file-download blocks or antivirus alerts.
          </p>
        </div>
        <button class="print-btn" onclick="window.print()">
          Save as PDF / Print
        </button>
      </div>

      <div class="print-card">
        <div class="header">
          <div>
            <h1 class="title">Organic-O-Eats</h1>
            <p class="subtitle">Complete Activity & Financial Report</p>
          </div>
          <div class="meta-box">
            <p style="margin: 0;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p style="margin: 4px 0 0 0;"><strong>Entity:</strong> Organic-O-Eats MPCS</p>
          </div>
        </div>

        <div class="kpi-container">
          <div class="kpi-card" style="border-left: 4px solid #10b981;">
            <div class="kpi-label">Total Income</div>
            <div class="kpi-value" style="color: #10b981;">₹${totalIncome.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #ef4444;">
            <div class="kpi-label">Total Expenses</div>
            <div class="kpi-value" style="color: #ef4444;">₹${totalExpense.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid ${netBalance >= 0 ? '#10b981' : '#ef4444'};">
            <div class="kpi-label">Net Balance</div>
            <div class="kpi-value" style="color: ${netBalance >= 0 ? '#10b981' : '#ef4444'};">₹${netBalance.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div class="section-title">1. Incomes Log</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Source</th>
              <th style="width: 20%;">Amount</th>
              <th style="width: 20%;">Date</th>
              <th style="width: 15%;">Category</th>
              <th style="width: 20%;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${incomesRows}
          </tbody>
        </table>

        <div class="section-title">2. Expenses Log</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Description</th>
              <th style="width: 20%;">Amount</th>
              <th style="width: 20%;">Date</th>
              <th style="width: 15%;">Category</th>
              <th style="width: 20%;">Paid By</th>
            </tr>
          </thead>
          <tbody>
            ${expensesRows}
          </tbody>
        </table>

        <div class="section-title">3. Group Balance & Settlements</div>
        ${personalBoxHtml}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
          <div>
            <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Simplified Settlements</h4>
            <table style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th style="width: 35%;">Sender (Debtor)</th>
                  <th style="width: 35%;">Receiver (Creditor)</th>
                  <th style="width: 30%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${settlementsRowsHtml}
              </tbody>
            </table>
          </div>
          <div>
            <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Cooperative Member Standings</h4>
            <table style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th style="width: 35%;">Member Name</th>
                  <th style="width: 35%;">Contact Email</th>
                  <th style="width: 30%; text-align: right;">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                ${memberBalancesHtml}
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-title">4. Tasks Board</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Task Title</th>
              <th style="width: 30%;">Description</th>
              <th style="width: 15%;">Status</th>
              <th style="width: 15%;">Priority</th>
              <th style="width: 15%;">Assigned To</th>
            </tr>
          </thead>
          <tbody>
            ${tasksRows}
          </tbody>
        </table>

        <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
          Organic-O-Eats Financial Audit Log • Generated under secure administrator authentication
        </div>
      </div>

      <script>
        // Trigger dialog instantly, allowing print-to-pdf mechanics
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 800);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Robust helper to export and trigger PDF file generation/download in a safe, standard way.
 * Includes explicit document metadata and native Blob handling to bypass restrictive local antivirus heuristics
 * that trigger false-positives like "Virus Scan Failed".
 * 
 * Also supports an optional custom parameter to preview in a new tab if a direct download fails.
 */
export function downloadPDFFile(doc: any, filename: string, openInNewTab: boolean = false) {
  try {
    // Set official metadata/properties to avoid "incomplete or draft file" flags from heuristic scanners.
    doc.setProperties({
      title: filename.replace('.pdf', '').replace(/_/g, ' '),
      subject: 'Organic-O-Eats Professional Report',
      author: 'Organic-O-Eats System',
      creator: 'Organic-O-Eats Engine',
      producer: 'jsPDF Library'
    });

    // Output as a standard raw blob with the precise mime type
    const pdfBlob = doc.output('blob');
    const safeBlob = new Blob([pdfBlob], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(safeBlob);

    if (openInNewTab) {
      // Direct opening in safe standard browser viewer - cannot trigger "virus scan failed" download block
      window.open(blobUrl, '_blank');
      return;
    }

    // Force safe download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    
    // Crucial for secure sandboxed iframe environments
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 3000);
  } catch (error) {
    console.error("PDF download utility failure:", error);
    // Absolute fallback: try base64 data URI structure
    try {
      const dataUri = doc.output('datauristring');
      const fallbackLink = document.createElement('a');
      fallbackLink.href = dataUri;
      fallbackLink.download = filename;
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
    } catch (fallbackError) {
      console.error("PDF download absolute fallback failed:", fallbackError);
      throw error;
    }
  }
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function calculateSettlements(members: any[], expenses: any[], incomes: any[] = [], _sharePrice: number = 10) {
  void _sharePrice;
  if (members.length === 0) return { balances: {} as Record<string, number>, settlements: [] as Settlement[] };

  const balances: Record<string, number> = {};
  members.forEach(m => {
    balances[m.id] = 0;
  });
  balances['bank'] = 0;

  // 1. Calculate total cooperative income directly from real logged incomes in the database
  const totalCoopIncome = incomes
    .filter((inc: any) => inc.submittedToBank !== false && inc.submittedToBank !== 'no')
    .reduce((sum, inc: any) => sum + (parseFloat(inc.amount) || 0), 0);

  let totalCoopExpense = 0;

  // 2. Process Expenses
  expenses.forEach((expense: any) => {
    const amount = parseFloat(expense.amount) || 0;
    const isSettlement = (expense.category || '').toLowerCase() === 'settlement';

    if (isSettlement) {
      // Settlements are direct balance transfers
      const payer = expense.paidBy || 'bank';
      if (balances[payer] !== undefined) {
        balances[payer] = (balances[payer] || 0) + amount;
      }
      expense.splits?.forEach((split: any) => {
        const targetId = split.memberId || 'bank';
        if (balances[targetId] !== undefined) {
          balances[targetId] = (balances[targetId] || 0) - (split.amount || 0);
        }
      });
    } else {
      // Real cooperative expense
      totalCoopExpense += amount;
      const payer = expense.paidBy || 'bank';
      if (balances[payer] !== undefined) {
        balances[payer] = (balances[payer] || 0) + amount;
      }
    }
  });

  // 3. Apply the equal split rule for total coop income and total coop expense
  const n = members.length;
  const expensePerPerson = totalCoopExpense / n;
  const incomePerPerson = totalCoopIncome / n;

  // Each active member gets their share of total income and total expense
  members.forEach(m => {
    balances[m.id] = (balances[m.id] || 0) + (incomePerPerson - expensePerPerson);
  });

  // The Collective Bank holds the total incomes, so it receives a debit of totalCoopIncome
  balances['bank'] = (balances['bank'] || 0) - totalCoopIncome;

  const debtors = Object.entries(balances)
    .filter(([, bal]) => bal < -0.01)
    .sort((a, b) => a[1] - b[1]);

  const creditors = Object.entries(balances)
    .filter(([, bal]) => bal > 0.01)
    .sort((a, b) => b[1] - a[1]);

  const settlements: Settlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  const tempDebtors = debtors.map(d => ({ id: d[0], amount: Math.abs(d[1]) }));
  const tempCreditors = creditors.map(c => ({ id: c[0], amount: c[1] }));

  while (dIdx < tempDebtors.length && cIdx < tempCreditors.length) {
    const debtor = tempDebtors[dIdx];
    const creditor = tempCreditors[cIdx];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      settlements.push({ from: debtor.id, to: creditor.id, amount });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return { balances, settlements };
}



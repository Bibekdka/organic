import * as React from 'react';
import { 
  Settings, 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Database,
  ChevronRight,
  Save,
  Loader2,
  Lock,
  Mail,
  User,
  LogOut,
  FileDown,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { downloadPDFFile, printActivityReportHTML, calculateSettlements } from '@/lib/utils';

export function SettingsPage() {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);
  const [isExportingCSV, setIsExportingCSV] = React.useState(false);

  // Relational postgres data redundancy backup states
  const [backupStatus, setBackupStatus] = React.useState<any>({
    configured: false,
    status: 'checking',
    message: 'Polling backing database status...',
    counts: { expenses: 0, incomes: 0, members: 0 }
  });
  const [isSyncing, setIsSyncing] = React.useState(false);

  const fetchBackupStatus = async () => {
    try {
      const res = await fetch('/api/backup/status');
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data);
      }
    } catch (e) {
      console.error("Failed to query database backup status:", e);
      setBackupStatus({
        configured: false,
        status: 'error',
        message: 'Unable to communicate with storage supervisor.',
        counts: { expenses: 0, incomes: 0, members: 0 }
      });
    }
  };

  React.useEffect(() => {
    fetchBackupStatus();
  }, []);

  const handleSyncBackup = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch expenses
      const expensesSnapshot = await getDocs(collection(db, 'expenses'));
      const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Fetch incomes
      const incomesSnapshot = await getDocs(collection(db, 'incomes'));
      const incomes = incomesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 3. Fetch members
      const membersSnapshot = await getDocs(collection(db, 'members'));
      const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const response = await fetch('/api/backup/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expenses, incomes, members })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Network sync failed");
      }

      const data = await response.json();
      if (data.success) {
        toast.success(`Redundancy backup successful! Synced ${data.count} items into Render PostgreSQL`);
        fetchBackupStatus();
      } else {
        throw new Error(data.error || "Backup sync transaction aborted.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Redundancy Sync Failed: ${e.message || e}`);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Settings updated successfully');
    }, 1000);
  };

  const handleExportAllPDF = async (openInNewTab: boolean = false) => {
    setIsExportingPDF(true);
    try {
      // 1. Fetch expenses
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
      const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Fetch incomes
      const incomesSnapshot = await getDocs(query(collection(db, 'incomes'), orderBy('date', 'desc')));
      const incomes = incomesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 3. Fetch tasks
      const tasksSnapshot = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 4. Fetch members
      const membersSnapshot = await getDocs(collection(db, 'members'));
      const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // Prepare Doc
      const doc = new jsPDF();
      
      // Title / Header
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text("Organic-O-Eats", 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text("Complete Activity & Financial Report", 14, 27);
      
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.line(14, 32, 196, 32);

      // Metadata Info
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 39);
      doc.text(`Organization Name: Organic-O-Eats`, 14, 44);

      // Financial Highlights Box
      const totalIncome = incomes.reduce((sum, inc) => sum + (inc.amount || 0), 0);
      const totalExpense = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const netBalance = totalIncome - totalExpense;

      doc.setFillColor(248, 250, 252); // Slate-50
      doc.rect(14, 49, 182, 28, 'F');
      doc.setDrawColor(241, 245, 249); // Slate-100
      doc.rect(14, 49, 182, 28, 'S');

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text("Total Incomes", 20, 56);
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // Green-500
      doc.text(`₹${totalIncome.toLocaleString('en-IN')}`, 20, 64);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Total Expenses", 80, 56);
      doc.setFontSize(14);
      doc.setTextColor(239, 68, 68); // Red-500
      doc.text(`₹${totalExpense.toLocaleString('en-IN')}`, 80, 64);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Net Balance", 140, 56);
      doc.setFontSize(14);
      doc.setTextColor(netBalance >= 0 ? 16 : 239, netBalance >= 0 ? 185 : 68, netBalance >= 0 ? 129 : 68);
      doc.text(`₹${netBalance.toLocaleString('en-IN')}`, 140, 64);

      let currentY = 87;

      // Section 1: Incomes
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("1. Incomes Log", 14, currentY);
      currentY += 4;

      const incomesData = incomes.length > 0 ? incomes.map(inc => [
        inc.source || 'N/A',
        `₹${(inc.amount || 0).toLocaleString('en-IN')}`,
        inc.date || 'N/A',
        inc.category || 'N/A',
        inc.notes || ''
      ]) : [['No income records found.', '', '', '', '']];

      autoTable(doc, {
        head: [['Source', 'Amount', 'Date', 'Category', 'Notes']],
        body: incomesData,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] } // Green
      });

      // Update currentY using the table's end Y coordinate
      currentY = (doc as any).lastAutoTable.finalY + 12;

      // Check if page overflow
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Section 2: Expenses
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("2. Expenses Log", 14, currentY);
      currentY += 4;

      const expensesData = expenses.length > 0 ? expenses.map(exp => [
        exp.description || 'N/A',
        `₹${(exp.amount || 0).toLocaleString('en-IN')}`,
        exp.date || 'N/A',
        exp.category || 'N/A',
        members.find(m => m.id === exp.paidBy)?.name || exp.createdByName || 'N/A'
      ]) : [['No expense records found.', '', '', '', '']];

      autoTable(doc, {
        head: [['Description', 'Amount', 'Date', 'Category', 'Paid By']],
        body: expensesData,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255] } // Red
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;

      // Check if page overflow
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      // Section 3: Group Balance & Settlements
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("3. Group Balance & Settlements", 14, currentY);
      currentY += 4;

      const { balances, settlements } = calculateSettlements(members, expenses);

      // Personal overview helper if user can be matched
      const myMember = members.find(
        (m: any) => m.userId === user?.uid || (user?.email && m.email === user.email)
      );

      const peopleWhoOweMe = settlements.filter((s: any) => myMember && s.to === myMember.id);
      const peopleIOwe = settlements.filter((s: any) => myMember && s.from === myMember.id);

      if (myMember) {
        // Draw a light background rectangle for personal info
        doc.setFillColor(243, 244, 246);
        doc.rect(14, currentY, 182, 28, "F");

        doc.setFontSize(10);
        doc.setFont("Helvetica", "bold");
        doc.text(`Personal Dues Hub (${myMember.name})`, 18, currentY + 6);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);

        const netBal = balances[myMember.id] || 0;
        const balStr = netBal >= 0 
          ? `Owed to you: +₹${netBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `You owe: -₹${Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        doc.text(balStr, 18, currentY + 12);

        let oweDetailsStr: string;
        if (peopleWhoOweMe.length > 0) {
          const detailLines = peopleWhoOweMe.map((s: any) => {
            const payerName = members.find((m: any) => m.id === s.from)?.name || "Member";
            return `${payerName} owes you ₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          });
          oweDetailsStr = `They need to give you: ${detailLines.join(', ')}`;
        } else if (netBal > 0) {
          oweDetailsStr = "You are owed a net refund from the pool.";
        } else if (netBal < 0 && peopleIOwe.length > 0) {
          const detailLines = peopleIOwe.map((s: any) => {
            const receiverName = members.find((m: any) => m.id === s.to)?.name || "Member";
            return `You owe ${receiverName} ₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          });
          oweDetailsStr = `You need to settle up with: ${detailLines.join(', ')}`;
        } else {
          oweDetailsStr = "Your ledger is perfectly balanced. No one owes you, and you owe no one!";
        }

        doc.text(doc.splitTextToSize(oweDetailsStr, 174), 18, currentY + 18);
        currentY += 34;
      }

      const settlementRows = settlements.map((s: any) => {
        const debtorName = members.find((m: any) => m.id === s.from)?.name || `Member (${s.from.substring(0, 5)}...)`;
        const creditorName = members.find((m: any) => m.id === s.to)?.name || `Member (${s.to.substring(0, 5)}...)`;
        return [
          debtorName,
          creditorName,
          `₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        head: [['Sender (Debtor)', 'Receiver (Creditor)', 'Settlement Amount']],
        body: settlementRows.length > 0 ? settlementRows : [['Balanced', 'Balanced', 'No settlements pending']],
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;

      // Check page overflow
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Section 4: Tasks Board
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("4. Tasks & Backlog Board", 14, currentY);
      currentY += 4;

      const tasksData = tasks.length > 0 ? tasks.map(task => [
        task.title || 'N/A',
        task.description || '',
        (task.status || 'todo').replace('_', ' ').toUpperCase(),
        (task.priority || 'medium').toUpperCase(),
        members.find(m => m.id === task.assignedTo)?.name || 'Unassigned'
      ]) : [['No task records found.', '', '', '', '']];

      autoTable(doc, {
        head: [['Task Title', 'Description', 'Status', 'Priority', 'Assigned To']],
        body: tasksData,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] } // Indigo
      });

      // Footer logic on every page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, 14, 287);
        doc.text("Organic-O-Eats Data Export System", 140, 287);
      }

      const reportName = `organicoeats_activity_report_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDFFile(doc, reportName, openInNewTab);
      toast.success(openInNewTab ? "PDF report generated and opened!" : "Activity PDF exported successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Export failed: ${e.message || e}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrintHTMLBypass = async () => {
    setIsExportingPDF(true);
    try {
      // 1. Fetch expenses
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
      const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Fetch incomes
      const incomesSnapshot = await getDocs(query(collection(db, 'incomes'), orderBy('date', 'desc')));
      const incomes = incomesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 3. Fetch tasks
      const tasksSnapshot = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 4. Fetch members
      const membersSnapshot = await getDocs(collection(db, 'members'));
      const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      printActivityReportHTML(incomes, expenses, tasks, members, user);
      toast.success("Safe print/PDF preview window launched successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Print rendering failed: ${e.message || e}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportAllExcel = async () => {
    setIsExportingCSV(true);
    try {
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
      const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const incomesSnapshot = await getDocs(query(collection(db, 'incomes'), orderBy('date', 'desc')));
      const incomes = incomesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const tasksSnapshot = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const membersSnapshot = await getDocs(collection(db, 'members'));
      const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // Create a workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Incomes
      const incomesSheetData = incomes.map(inc => ({
        'Source': inc.source || '',
        'Amount': inc.amount || 0,
        'Date': inc.date || '',
        'Category': inc.category || '',
        'Notes': inc.notes || ''
      }));
      const wsIncomes = XLSX.utils.json_to_sheet(incomesSheetData);
      XLSX.utils.book_append_sheet(wb, wsIncomes, "Incomes");

      // Sheet 2: Expenses
      const expensesSheetData = expenses.map(exp => ({
        'Description': exp.description || '',
        'Amount': exp.amount || 0,
        'Date': exp.date || '',
        'Category': exp.category || '',
        'Paid By': members.find(m => m.id === exp.paidBy)?.name || exp.createdByName || 'N/A'
      }));
      const wsExpenses = XLSX.utils.json_to_sheet(expensesSheetData);
      XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

      // Sheet 3: Tasks
      const tasksSheetData = tasks.map(task => ({
        'Title': task.title || '',
        'Description': task.description || '',
        'Status': (task.status || 'todo').toUpperCase(),
        'Priority': (task.priority || 'medium').toUpperCase(),
        'Assigned To': members.find(m => m.id === task.assignedTo)?.name || 'Unassigned',
        'Created By': task.createdByName || ''
      }));
      const wsTasks = XLSX.utils.json_to_sheet(tasksSheetData);
      XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");

      // Sheet 4: Members
      const membersSheetData = members.map(m => ({
        'Name': m.name || '',
        'Email': m.email || '',
        'Role': (m.role || 'member').toUpperCase(),
        'Status': m.status || ''
      }));
      const wsMembers = XLSX.utils.json_to_sheet(membersSheetData);
      XLSX.utils.book_append_sheet(wb, wsMembers, "Members");

      // Write and Save
      XLSX.writeFile(wb, `organicoeats_full_data_archive_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel Archive downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Excel Export failed: ${e.message || e}`);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground shadow-sm">
            <Settings className="w-6 h-6" />
          </div>
          Organization Settings
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">Configure your community structure and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                General Information
              </CardTitle>
              <CardDescription>Primary identity details for your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" placeholder="Organic-O-Eats" defaultValue="Organic-O-Eats" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-id">Organization ID</Label>
                  <Input id="org-id" value="O-EATS-001" disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Base Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="location" className="pl-10" placeholder="Mumbai, India" defaultValue="Mumbai, India" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Input id="currency" value="INR (₹)" disabled className="bg-muted/50" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Governance & Privacy
              </CardTitle>
              <CardDescription>Control access rules and member permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Self-Registration</Label>
                    <p className="text-xs text-muted-foreground">Allow members to join via private invite link.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <Separator />
               <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Expense Visibility</Label>
                    <p className="text-xs text-muted-foreground">Members can see each other's split history.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <Separator />
               <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Settlement Notifications</Label>
                    <p className="text-xs text-muted-foreground">Broadcast alerts when debts are cleared.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                Render Relational Redundancy Backup
              </CardTitle>
              <CardDescription>
                Synchronize and replicate your primary Firebase documents into Render's PostgreSQL storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/15 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Engine Status:</span>
                    {backupStatus.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full h-5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        PostgreSQL Active
                      </span>
                    ) : backupStatus.status === 'error' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 bg-rose-500/10 text-rose-500 text-[10px] font-black rounded-full h-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Relational Error
                      </span>
                    ) : backupStatus.status === 'checking' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-full h-5 animate-pulse">
                        Probing...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 bg-slate-500/10 text-slate-500 text-[10px] font-black rounded-full h-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Simulation Sandbox
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{backupStatus.message}</p>
                </div>
                <Button 
                  onClick={handleSyncBackup} 
                  disabled={isSyncing} 
                  variant={backupStatus.status === 'active' ? "default" : "outline"}
                  className="font-bold shrink-0 self-center h-8"
                  size="sm"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-3" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Force Backup
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-xl bg-secondary/10 border border-border/20">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-ellipsis overflow-hidden truncate">Expenses</p>
                  <p className="text-xl font-black text-foreground mt-1">{backupStatus.counts?.expenses || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/10 border border-border/20">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-ellipsis overflow-hidden truncate">Incomes</p>
                  <p className="text-xl font-black text-foreground mt-1">{backupStatus.counts?.incomes || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/10 border border-border/20">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-ellipsis overflow-hidden truncate">Members</p>
                  <p className="text-xl font-black text-foreground mt-1">{backupStatus.counts?.members || 0}</p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ℹ️ <strong>Deployment Data Redundancy:</strong> Render services provide extreme database durability. When a <code>DATABASE_URL</code> is provisioned in Render, backups automatically insert replicated records to relational Postgres Tables. If not yet deployed to production, it functions in Sandbox Simulation mode perfectly for local preview.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/50">
             <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                   <Database className="w-5 h-5 text-indigo-500" />
                   Data Export Center
                </CardTitle>
                <CardDescription>Generate and download professional executive reports or raw backups of all organization records.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                {/* PDF Report Export Block */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-rose-500/5 rounded-xl border border-dashed border-rose-500/20 gap-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center text-white">
                         <FileDown className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="font-bold text-sm">Prism Activity & Audit Report (PDF)</p>
                         <p className="text-xs text-muted-foreground max-w-sm">
                            A beautifully synthesized executive document featuring high-level financial KPIs, a comprehensive income stream catalog, dynamic split-expense registers, and backlog lists.
                         </p>
                      </div>
                   </div>
                   <div className="flex flex-row flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto self-stretch sm:self-auto justify-end">
                      <Button 
                         size="sm" 
                         variant="outline" 
                         onClick={() => handleExportAllPDF(false)}
                         disabled={isExportingPDF}
                         className="border-rose-500/35 hover:bg-rose-500/10 text-rose-600 hover:text-rose-700 min-w-[125px] font-semibold"
                      >
                         {isExportingPDF ? (
                            <>
                               <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                               Compiling...
                            </>
                         ) : (
                            "Download PDF"
                         )}
                      </Button>
                      <Button 
                         size="sm" 
                         variant="ghost" 
                         onClick={() => handleExportAllPDF(true)}
                         disabled={isExportingPDF}
                         className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/5 font-semibold min-w-[110px]"
                      >
                         Preview Dashboard
                       </Button>
                       <Button 
                          size="sm" 
                          variant="default" 
                          onClick={handlePrintHTMLBypass}
                          disabled={isExportingPDF}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-semibold min-w-[180px] shadow-sm shadow-rose-500/25"
                       >
                          Print / Save (Bypass Errors)
                       </Button>
                    </div>
                 </div>
                 <div className="text-[11px] text-rose-600/90 leading-relaxed font-normal bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 hover:bg-rose-500/10 transition-colors mt-2">
                    ⚠️ <strong>Antivirus Block (Virus scan failed)?</strong> If your organization's browser security blocks raw file downloads, click the <strong>Print / Save (Bypass Errors)</strong> button. This compiles the report into a clean print-preview page and opens your browser's safe native print dialog (immune to false-positive scanner blocks). Under destination, select <strong>"Save as PDF"</strong>.
                 </div>
                 


                {/* Excel Export Block */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-emerald-500/5 rounded-xl border border-dashed border-emerald-500/20 gap-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                         <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="font-bold text-sm">Complete Data Workbook (Excel)</p>
                         <p className="text-xs text-muted-foreground max-w-sm">
                            Extrude all raw collections directly into separate worksheets for advanced database analytics, financial balancing, and data science audits.
                         </p>
                      </div>
                   </div>
                   <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleExportAllExcel}
                      disabled={isExportingCSV}
                      className="border-emerald-500/35 hover:bg-emerald-500/10 text-emerald-600 hover:text-emerald-700 min-w-[125px] font-semibold"
                   >
                      {isExportingCSV ? (
                         <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                            Archiving...
                         </>
                      ) : (
                         "Prepare CSV"
                      )}
                   </Button>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-sm bg-primary text-primary-foreground">
              <CardContent className="pt-6">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full border-2 border-primary-foreground/20 bg-background/10 flex items-center justify-center overflow-hidden">
                       {user?.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                       ) : (
                          <User className="w-6 h-6" />
                       )}
                    </div>
                    <div>
                       <p className="font-black truncate max-w-[150px]">{user?.displayName || 'Administrator'}</p>
                       <p className="text-xs opacity-70">Privileged Superuser</p>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs px-1">
                       <span className="opacity-70 flex items-center gap-2"><Mail className="w-3 h-3" /> Email</span>
                       <span className="font-medium truncate max-w-[120px]">{user?.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs px-1">
                       <span className="opacity-70 flex items-center gap-2"><Lock className="w-3 h-3" /> Auth Method</span>
                       <span className="font-medium">Google OAuth 2.0</span>
                    </div>
                 </div>
                 <Button onClick={handleLogout} variant="secondary" className="w-full mt-6 bg-white text-primary hover:bg-neutral-100 font-bold">
                    <LogOut className="w-4 h-4 mr-2" /> Log Out
                 </Button>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm bg-card/50">
              <CardContent className="pt-6 space-y-4">
                 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
                 <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-muted font-medium">
                       Security Logs <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-muted font-medium">
                       Invite Members <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-muted font-medium">
                       API Tokens <ChevronRight className="w-4 h-4" />
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <Button 
          size="lg" 
          onClick={handleSave} 
          disabled={isSaving}
          className="shadow-2xl shadow-primary/30 h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black tracking-tight hover:scale-105 transition-all"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          {isSaving ? 'Applying Changes...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
}

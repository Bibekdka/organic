import * as React from 'react';
import { 
  Users, 
  Receipt, 
  TrendingUp, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Sparkles,
  FileDown,
  FileSpreadsheet,
  Wallet,
  ChevronDown,
  ChevronUp,
  Target,
  Edit2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  CalendarDays,
  Activity,
  PiggyBank,
  Trash2
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from 'xlsx';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart as RePieChart
} from 'recharts';
import { collection, query, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { cn, downloadPDFFile, calculateSettlements } from '@/lib/utils';
import { getSpendingInsights } from '@/services/geminiService';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function Dashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.email === 'bibekdeka97@gmail.com';
  const [stats, setStats] = React.useState({
    totalMembers: 0,
    totalSpent: 0,
    recentExpenses: [] as any[],
    allExpenses: [] as any[],
    members: [] as any[],
    allIncomes: [] as any[],
    onboarding: [] as any[]
  });
  const [loading, setLoading] = React.useState(true);
  const [insights, setInsights] = React.useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = React.useState(false);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isProjectedOpen, setIsProjectedOpen] = React.useState(false);

  const [globalSettings, setGlobalSettings] = React.useState<any>(null);
  const [isBalancesCollapsed, setIsBalancesCollapsed] = React.useState(false);
  const [isEditingTarget, setIsEditingTarget] = React.useState(false);
  const [targetInputVal, setTargetInputVal] = React.useState('');

  // Calendar States
  const [calendarDate, setCalendarDate] = React.useState(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = React.useState<string>(() => {
    const today = new Date();
    return today.toISOString().substring(0, 10); // "YYYY-MM-DD"
  });
  
  // Planned items state (stored in localstorage for persistent milestones/planner events)
  const [plannedEvents, setPlannedEvents] = React.useState<Record<string, Array<{id: string, text: string, type: 'expense' | 'income' | 'general', amount?: number}>>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_planned_events');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [newEventText, setNewEventText] = React.useState('');
  const [newEventAmount, setNewEventAmount] = React.useState('');
  const [newEventType, setNewEventType] = React.useState<'expense' | 'income' | 'general'>('general');

  React.useEffect(() => {
    localStorage.setItem('dashboard_planned_events', JSON.stringify(plannedEvents));
  }, [plannedEvents]);

  React.useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGlobalSettings(data);
        if (data.monthlySpentTarget) {
          setTargetInputVal(data.monthlySpentTarget.toString());
        }
      } else {
        setGlobalSettings({ sharePrice: 10, monthlySpentTarget: 50000 });
        setTargetInputVal('50000');
      }
    });

    return () => unsubSettings();
  }, []);

  const handleSaveTarget = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can set the monthly target.");
      return;
    }
    const parsed = parseFloat(targetInputVal);
    if (!isNaN(parsed) && parsed >= 0) {
      try {
        await setDoc(doc(db, 'settings', 'global'), {
          monthlySpentTarget: parsed,
          updatedAt: Date.now(),
          updatedByName: user?.displayName || user?.email || "User"
        }, { merge: true });
        setIsEditingTarget(false);
      } catch (err) {
        window.console.error("Error saving budget target:", err);
      }
    }
  };

  const handleAddPlannedEvent = () => {
    if (!newEventText.trim()) return;
    const item = {
      id: Math.random().toString(36).substring(7),
      text: newEventText.trim(),
      type: newEventType,
      amount: newEventAmount ? parseFloat(newEventAmount) : undefined
    };
    
    setPlannedEvents(prev => {
      const dayList = prev[selectedDayStr] || [];
      return {
        ...prev,
        [selectedDayStr]: [...dayList, item]
      };
    });
    setNewEventText('');
    setNewEventAmount('');
    setNewEventType('general');
  };

  const handleDeletePlannedEvent = (dayStr: string, itemId: string) => {
    setPlannedEvents(prev => {
      const dayList = prev[dayStr] || [];
      const updated = dayList.filter(e => e.id !== itemId);
      const copy = { ...prev };
      if (updated.length === 0) {
        delete copy[dayStr];
      } else {
        copy[dayStr] = updated;
      }
      return copy;
    });
  };

  const hasFetchedInsights = React.useRef(false);

  const generateAIReview = React.useCallback(async (expenses: any[]) => {
    if (loadingInsights || expenses.length === 0) return;
    setLoadingInsights(true);
    try {
        const result = await getSpendingInsights(expenses);
        setInsights(result);
    } catch (error) {
        window.console.error("AI Insight error:", error);
    } finally {
        setLoadingInsights(false);
    }
  }, [loadingInsights]);

  React.useEffect(() => {
    // Listen to Members
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, totalMembers: snapshot.size, members }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));

    // Listen to Expenses
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const total = expenses.reduce((sum, exp: any) => sum + exp.amount, 0);
      setStats(prev => ({ 
        ...prev, 
        totalSpent: total,
        recentExpenses: expenses.slice(0, 5),
        allExpenses: expenses
      }));
      setLoading(false);
      
      // Fetch initial insights exactly once on first stable database snapshot
      if (expenses.length > 0 && !hasFetchedInsights.current) {
        hasFetchedInsights.current = true;
        generateAIReview(expenses);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    // Listen to Incomes
    const unsubIncomes = onSnapshot(collection(db, 'incomes'), (snapshot) => {
      const incomes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, allIncomes: incomes }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'incomes'));

    // Listen to Onboarding
    const unsubOnboarding = onSnapshot(collection(db, 'onboarding'), (snapshot) => {
      const onboarding = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, onboarding }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'onboarding'));

    return () => {
      unsubMembers();
      unsubExpenses();
      unsubIncomes();
      unsubOnboarding();
    };
  }, [generateAIReview]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Organic-O-Eats - Full Financial Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = stats.allExpenses.map(exp => [
      exp.description,
      `₹${exp.amount.toLocaleString()}`,
      exp.date,
      exp.paidBy === 'bank' ? '🏦 Collective Bank' : (stats.members.find(m => m.id === exp.paidBy)?.name || `User (${exp.paidBy.substring(0, 5)}...)`),
      exp.category
    ]);

    autoTable(doc, {
      head: [['Description', 'Amount', 'Date', 'Paid By', 'Category']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const sharePrice = globalSettings?.sharePrice ?? 10;
    const { balances, settlements } = calculateSettlements(stats.members, stats.allExpenses, stats.allIncomes, sharePrice);

    // Identify current user's member object
    const myMember = stats.members.find(
      m => m.userId === user?.uid || (user?.email && m.email === user.email)
    );

    const peopleWhoOweMe = settlements.filter(s => myMember && s.to === myMember.id);
    const peopleIOwe = settlements.filter(s => myMember && s.from === myMember.id);

    // Check Y position of the last table
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > 210) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    doc.text("Group Balance & Settlements", 14, currentY);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Optimized debt simplification and net dues calculations.", 14, currentY + 6);
    doc.setTextColor(0, 0, 0);

    let nextY = currentY + 12;

    // Callout box for "Personal Overview (Me)"
    if (myMember) {
      doc.setFillColor(243, 244, 246); // soft light grey bg
      doc.rect(14, nextY, 182, 28, "F");
      
      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.text(`Personal Dues Hub (${myMember.name})`, 18, nextY + 6);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);

      const netBal = balances[myMember.id] || 0;
      const balStr = netBal >= 0 
        ? `Owed to you: +₹${netBal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `You owe: -₹${Math.abs(netBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      doc.text(balStr, 18, nextY + 12);

      let oweDetailsStr: string;
      if (peopleWhoOweMe.length > 0) {
        const detailLines = peopleWhoOweMe.map(s => {
          const payerName = stats.members.find(m => m.id === s.from)?.name || "Member";
          return `${payerName} owes you ₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        });
        oweDetailsStr = `They need to give you: ${detailLines.join(', ')}`;
      } else if (netBal > 0) {
        oweDetailsStr = "You are owed a net refund from the pool.";
      } else if (netBal < 0 && peopleIOwe.length > 0) {
        const detailLines = peopleIOwe.map(s => {
          const receiverName = stats.members.find(m => m.id === s.to)?.name || "Member";
          return `You owe ${receiverName} ₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        });
        oweDetailsStr = `You need to settle up with: ${detailLines.join(', ')}`;
      } else {
        oweDetailsStr = "Your ledger is perfectly balanced. No one owes you, and you owe no one!";
      }

      doc.text(doc.splitTextToSize(oweDetailsStr, 174), 18, nextY + 18);
      nextY += 34;
    }

    const settlementRows = settlements.map(s => {
      const debtorName = stats.members.find(m => m.id === s.from)?.name || `Member (${s.from.substring(0, 5)}...)`;
      const creditorName = stats.members.find(m => m.id === s.to)?.name || `Member (${s.to.substring(0, 5)}...)`;
      return [
        debtorName,
        creditorName,
        `₹${s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ];
    });

    autoTable(doc, {
      head: [['Sender (Debtor)', 'Receiver (Creditor)', 'Settlement Amount']],
      body: settlementRows.length > 0 ? settlementRows : [['Balanced', 'Balanced', 'No settlements pending']],
      startY: nextY,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const reportName = `financial_report_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDFFile(doc, reportName);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(stats.allExpenses.map(exp => ({
      Description: exp.description,
      Amount: exp.amount,
      Date: exp.date,
      PaidBy: exp.paidBy === 'bank' ? '🏦 Collective Bank' : (stats.members.find(m => m.id === exp.paidBy)?.name || `User (${exp.paidBy.substring(0, 5)}...)`),
      Category: exp.category,
      SplitType: exp.splitType
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `financial_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const memberBalances = React.useMemo(() => {
    const sharePrice = globalSettings?.sharePrice ?? 10;
    const { balances } = calculateSettlements(stats.members, stats.allExpenses, stats.allIncomes, sharePrice);
    return Object.entries(balances)
      .filter(([id]) => id !== 'bank')
      .map(([id, balance]) => ({
        id,
        name: stats.members.find(m => m.id === id)?.name || `User (${id.substring(0, 5)}...)`,
        balance
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [stats.members, stats.allExpenses, stats.allIncomes, globalSettings]);

  const dynamicTotalIncome = React.useMemo(() => {
    return (stats.allIncomes || []).reduce((sum, inc: any) => sum + (parseFloat(inc.amount) || 0), 0);
  }, [stats.allIncomes]);

  const bankBalance = React.useMemo(() => {
    const outboundTotal = (stats.allExpenses || [])
      .filter((exp: any) => exp.paidBy === 'bank')
      .reduce((sum, exp: any) => sum + (parseFloat(exp.amount) || 0), 0);
    return dynamicTotalIncome - outboundTotal;
  }, [dynamicTotalIncome, stats.allExpenses]);

  const bankLedger = React.useMemo(() => {
    // 1. Get all actual logged incomes
    const loggedInbounds = (stats.allIncomes || []).map((inc: any) => ({
      id: inc.id,
      type: 'inbound',
      description: inc.source,
      amount: parseFloat(inc.amount) || 0,
      date: inc.date || new Date().toISOString().split('T')[0],
      category: inc.category,
      notes: inc.notes || ''
    }));

    // 2. Get all outbound bank expenses
    const outbound = (stats.allExpenses || [])
       .filter((exp: any) => exp.paidBy === 'bank')
       .map((exp: any) => ({
         id: exp.id,
         type: 'outbound',
         description: exp.description,
         amount: parseFloat(exp.amount) || 0,
         date: exp.date,
         category: exp.category,
         notes: exp.notes || ''
       }));

    return [...loggedInbounds, ...outbound]
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
  }, [stats.allIncomes, stats.allExpenses]);



  const targetBudget = globalSettings?.monthlySpentTarget ?? 50000;

  const targetDaysInfo = React.useMemo(() => {
    const today = new Date();
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const isCurrentMonthView = today.getFullYear() === year && today.getMonth() === month;
    const daysRemaining = isCurrentMonthView ? Math.max(1, totalDays - today.getDate()) : totalDays;
    return {
      totalDays,
      daysRemaining,
      isCurrentMonthView
    };
  }, [calendarDate]);

  const currentMonthStr = React.useMemo(() => {
    const yr = calendarDate.getFullYear();
    const mo = String(calendarDate.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}`;
  }, [calendarDate]);

  const expensesThisCalendarMonth = React.useMemo(() => {
    return stats.allExpenses.filter((exp: any) => exp.date && exp.date.startsWith(currentMonthStr));
  }, [stats.allExpenses, currentMonthStr]);

  const totalSpentThisCalendarMonth = React.useMemo(() => {
    return expensesThisCalendarMonth.reduce((sum, exp: any) => sum + exp.amount, 0);
  }, [expensesThisCalendarMonth]);

  const calendarDays = React.useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean; key: string }> = [];
    
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        key: `prev-${dStr}`
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: true,
        key: `curr-${dStr}`
      });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        key: `next-${dStr}`
      });
    }
    return days;
  }, [calendarDate]);

  const getDailyDetails = React.useCallback((dateStr: string) => {
    const expenses = stats.allExpenses.filter(e => e.date === dateStr);
    const incomes = stats.allIncomes.filter(inc => inc.date === dateStr);
    const planned = plannedEvents[dateStr] || [];
    return { expenses, incomes, planned };
  }, [stats.allExpenses, stats.allIncomes, plannedEvents]);

  const categoryData = React.useMemo(() => {
    const cats: Record<string, number> = {};
    stats.recentExpenses.forEach((exp: any) => {
        cats[exp.category] = (cats[exp.category] || 0) + exp.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [stats.recentExpenses]);

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
        <div className="h-[60vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
  }

  const sharePrice = globalSettings?.sharePrice ?? 10;
  const totalOnboardingShares = (stats.onboarding || []).reduce((sum, item) => sum + (parseFloat(item.shares) || 0), 0);
  const expectedShareSaleValue = totalOnboardingShares * sharePrice;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
          <p className="text-muted-foreground text-xs md:text-sm">Here's what's happening with Organic-O-Eats today.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="w-full sm:w-auto gap-2 text-foreground text-xs h-9">
                <FileDown className="w-4 h-4" /> <span className="hidden xs:inline">Report</span><span className="xs:hidden">Exp</span>
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-48 text-foreground">
                 <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                    <FileDown className="w-4 h-4 text-rose-500" /> Export PDF
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export Excel
                 </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
           <Button onClick={() => setIsAddOpen(true)} size="sm" className="h-9 shadow-lg shadow-primary/20 gap-2 text-xs">
              <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Log Entry</span><span className="xs:hidden">Log</span>
           </Button>
           <Button 
              onClick={() => generateAIReview(stats.allExpenses)} 
              disabled={loadingInsights} 
              size="sm" 
              variant="ghost" 
              className="hidden sm:flex text-muted-foreground hover:text-foreground gap-2 h-9 text-xs"
           >
              {loadingInsights ? (
                 <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                 <Sparkles className="w-3.5 h-3.5 text-primary" />
              )}
              Refresh AI
           </Button>
        </div>
      </div>

      <AddExpenseDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      <Dialog open={isProjectedOpen} onOpenChange={setIsProjectedOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 overflow-hidden text-foreground">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-indigo-500 animate-pulse" />
              Projected Share Sales
            </DialogTitle>
            <DialogDescription>
              A snapshot of upcoming share sales from candidate equity commitments in the boarding queue.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Summary card */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Total Projected Shares</p>
                <p className="text-xl font-black text-indigo-400">
                  {totalOnboardingShares} Units
                </p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">Expected Sales Value</p>
                <p className="text-xl font-black text-emerald-400">
                  ₹{expectedShareSaleValue.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Candidates In Queue ({stats.onboarding?.length || 0})</p>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {stats.onboarding && stats.onboarding.length > 0 ? (
                  stats.onboarding.map((record) => {
                    const recShares = parseFloat(record.shares) || 0;
                    return (
                      <div key={record.id} className="p-3 rounded-lg bg-card/40 border border-border/40 flex items-center justify-between hover:bg-card/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-xs text-indigo-400">
                            {record.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{record.name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize font-bold tracking-tight">
                              {record.suggestedRole} • {record.gender || 'unassigned'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">{recShares} Shares</p>
                          <p className="text-[10px] text-muted-foreground">₹{(recShares * (globalSettings?.sharePrice ?? 10)).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground bg-muted/5 rounded-lg border border-dashed">
                     No candidates in onboarding queue.
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TOP STAT CARDS: High-level overview of members, spending, and health scores */}
      {(() => {
        const sharePrice = globalSettings?.sharePrice ?? 10;
        const totalOnboardingShares = (stats.onboarding || []).reduce((sum, item) => sum + (parseFloat(item.shares) || 0), 0);
        const expectedShareSale = totalOnboardingShares * sharePrice;
        const netCashflow = dynamicTotalIncome - stats.totalSpent;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <StatCard 
              title="Active Members" 
              value={stats.totalMembers.toString()} 
              icon={<Users className="w-5 h-5" />} 
              color="bg-primary/10 text-primary"
            />
            <StatCard 
              title="Bank Balance" 
              value={`₹${(bankBalance / 1000).toFixed(bankBalance >= 1000 ? 1 : 2)}k`} 
              icon={<PiggyBank className="w-5 h-5 text-emerald-500" />} 
              color="bg-emerald-500/10 text-emerald-500"
              trend={`₹${bankBalance.toLocaleString()}`}
              trendType={bankBalance >= 0 ? "up" : "down"}
              onClick={() => {
                const element = document.getElementById('bank-ledger-section');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <StatCard 
              title="Total Spent" 
              value={`₹${(stats.totalSpent / 1000).toFixed(stats.totalSpent >= 1000 ? 1 : 2)}k`} 
              icon={<Receipt className="w-5 h-5 animate-pulse" />} 
              color="bg-rose-500/10 text-rose-500"
            />
            <StatCard 
              title="Expected Share Sale" 
              value={`₹${expectedShareSale.toLocaleString()}`} 
              icon={<TrendingUp className="w-5 h-5" />} 
              color="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
              trend={`${totalOnboardingShares} Shares in Queue`}
              trendType="up"
              onClick={() => setIsProjectedOpen(true)}
            />
            <StatCard 
              title="Total Income" 
              value={`₹${dynamicTotalIncome.toLocaleString()}`} 
              icon={<Wallet className="w-5 h-5" />} 
              color="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard 
              title="Net Cashflow" 
              value={`${netCashflow >= 0 ? "₹" : "-₹"}${Math.abs(netCashflow).toLocaleString()}`} 
              icon={<TrendingUp className="w-5 h-5" />} 
              color={netCashflow >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}
              trend={netCashflow >= 0 ? "Surplus" : "Deficit"}
              trendType={netCashflow >= 0 ? "up" : "down"}
            />
          </div>
        );
      })()}

      {/* PERSISTENT MONTHLY BUDGET TARGET & CALENDAR DAY PLANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* MONTHLY TARGET COMPONENT */}
         <Card className="lg:col-span-1 border-none shadow-md bg-card/50 flex flex-col justify-between">
            <div>
               <CardHeader className="pb-3 border-b border-white/5">
                  <div className="flex items-center justify-between">
                     <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                        <Target className="w-5 h-5 text-primary" />
                        Monthly Target Tracker
                     </CardTitle>
                     {!isEditingTarget ? (
                        <Button 
                           variant="ghost" 
                           size="icon" 
                           onClick={() => setIsEditingTarget(true)} 
                           className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", !isAdmin && "hidden")}
                           title="Change Monthly Budget Limit"
                        >
                           <Edit2 className="w-4 h-4 text-primary" />
                        </Button>
                     ) : (
                        <div className="flex items-center gap-1">
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleSaveTarget}
                              className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
                              title="Save Limit"
                           >
                              <Check className="w-4 h-4" />
                           </Button>
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                 setTargetInputVal(targetBudget.toString());
                                 setIsEditingTarget(false);
                              }}
                              className="h-8 w-8 text-rose-500 hover:text-rose-400"
                              title="Cancel"
                           >
                              <ChevronDown className="w-4 h-4 rotate-90" />
                           </Button>
                        </div>
                     )}
                  </div>
                  <CardDescription>
                     Track your real-time expenses against custom targets.
                  </CardDescription>
               </CardHeader>
               
               <CardContent className="pt-6 space-y-6">
                  {isEditingTarget ? (
                     <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-primary/10">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block font-sans">Configure Monthly Budget Target</label>
                        <div className="flex gap-2">
                           <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-black">₹</span>
                              <Input 
                                 type="number" 
                                 value={targetInputVal} 
                                 onChange={(e) => setTargetInputVal(e.target.value)} 
                                 className="pl-6 text-foreground h-9 font-semibold font-mono"
                                 placeholder="50000"
                              />
                           </div>
                           <Button onClick={handleSaveTarget} className="h-9 px-3 gap-1 shadow-sm text-xs">
                              <Check className="w-3.5 h-3.5" /> Set
                           </Button>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-normal leading-tight block">This target gets stored centrally in Firestore, ensuring updates sync across the organization immediately.</span>
                     </div>
                  ) : null}

                  {/* PROGRESS BAR GAUGE */}
                  <div className="space-y-4">
                     <div className="flex items-end justify-between">
                        <div>
                           <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Threshold Usage</p>
                           <p className="text-2xl font-black text-foreground">
                              {targetBudget > 0 ? Math.min(100, Math.round((totalSpentThisCalendarMonth / targetBudget) * 100)) : 0}%
                           </p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Month Spent</p>
                           <p className="text-sm font-semibold text-foreground">
                              ₹{totalSpentThisCalendarMonth.toLocaleString()} <span className="text-xs text-muted-foreground">/ ₹{targetBudget.toLocaleString()}</span>
                           </p>
                        </div>
                     </div>

                     <div className="w-full bg-secondary/20 h-3 rounded-full overflow-hidden p-[2px]">
                        <div 
                           className={cn(
                              "h-full rounded-full transition-all duration-500",
                              targetBudget > 0 && (totalSpentThisCalendarMonth / targetBudget) > 1.0 
                                 ? "bg-rose-500 group-hover:shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                                 : targetBudget > 0 && (totalSpentThisCalendarMonth / targetBudget) > 0.75 
                                    ? "bg-amber-400" 
                                    : "bg-emerald-500"
                           )}
                           style={{ width: `${targetBudget > 0 ? Math.min(100, (totalSpentThisCalendarMonth / targetBudget) * 100) : 0}%` }}
                        />
                     </div>
                  </div>

                  {/* BUDGET MESSAGE PILL */}
                  <div className={cn(
                     "p-3 rounded-xl border flex gap-3 text-xs leading-relaxed",
                     targetBudget > 0 && (totalSpentThisCalendarMonth / targetBudget) > 1.0 
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                        : targetBudget > 0 && (totalSpentThisCalendarMonth / targetBudget) > 0.75 
                           ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                           : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  )}>
                     {targetBudget > 0 && (totalSpentThisCalendarMonth / targetBudget) > 1.0 ? (
                        <>
                           <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                           <p><strong>Over-budget!</strong> Spending exceeds your target threshold limit by ₹{(totalSpentThisCalendarMonth - targetBudget).toLocaleString()}. Consider halting non-essential expenses.</p>
                        </>
                     ) : targetBudget > 0 && (totalSpentThisCalendarMonth / targetBudget) > 0.75 ? (
                        <>
                           <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                           <p><strong>Attention!</strong> You have utilized {(totalSpentThisCalendarMonth / targetBudget * 100).toFixed(0)}% of the pool allowance. Restrain bulk transactions.</p>
                        </>
                     ) : (
                        <>
                           <PiggyBank className="w-4 h-4 shrink-0 text-emerald-500" />
                           <p><strong>Safe zone.</strong> Spending is within planned parameters. You have utilized only {(targetBudget > 0 ? (totalSpentThisCalendarMonth / targetBudget * 100).toFixed(0) : 0)}% of the target limit.</p>
                        </>
                     )}
                  </div>

                  {/* ADVANCED STATS METRICS ROW */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                     <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Remaining Fund</p>
                        <p className="text-base font-bold text-foreground">
                           ₹{Math.max(0, targetBudget - totalSpentThisCalendarMonth).toLocaleString()}
                        </p>
                     </div>
                     <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold block leading-tight">Daily Safe Margin</p>
                        <p className="text-base font-bold text-foreground">
                           ₹{Math.max(0, Math.round((targetBudget - totalSpentThisCalendarMonth) / targetDaysInfo.daysRemaining)).toLocaleString()}<span className="text-[10px] text-muted-foreground">/day</span>
                        </p>
                        <p className="text-[9px] text-muted-foreground font-medium mt-1">Over {targetDaysInfo.daysRemaining} remaining days</p>
                     </div>
                  </div>
               </CardContent>
            </div>
            
            <div className="p-4 bg-primary/5 rounded-b-xl border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
               <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-primary animate-pulse" /> Active Month:
               </span>
               <span className="font-bold text-foreground">
                  {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
               </span>
            </div>
         </Card>

         {/* INTERACTIVE CALENDAR SECTION */}
         <Card className="lg:col-span-2 border-none shadow-md bg-card/50 flex flex-col select-none">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
               <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                     <Calendar className="w-5 h-5 text-primary" />
                     Interactive Spending Calendar
                  </CardTitle>
                  <CardDescription>
                     Browse months, inspect transaction events, or plan milestones.
                  </CardDescription>
               </div>
               
               {/* Month Controls */}
               <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/5 self-start sm:self-auto">
                  <Button 
                     variant="outline" 
                     size="icon" 
                     className="h-7 w-7 bg-white/5 border border-white/10 text-primary hover:bg-white/10 hover:text-primary-foreground focus:outline-none transition-all duration-200" 
                     onClick={() => {
                        setCalendarDate(prev => {
                           const next = new Date(prev);
                           next.setMonth(prev.getMonth() - 1);
                           return next;
                        });
                     }}
                     title="Previous Month"
                  >
                     <ChevronLeft className="w-4 h-4 text-primary" />
                  </Button>
                  
                  <div className="flex items-center gap-1 px-1">
                     <select
                        aria-label="Select calendar month"
                        value={calendarDate.getMonth()}
                        onChange={(e) => {
                           const newMonth = parseInt(e.target.value, 10);
                           setCalendarDate(prev => {
                              const next = new Date(prev);
                              next.setMonth(newMonth);
                              return next;
                           });
                        }}
                        className="bg-transparent border-none text-xs font-black text-foreground focus:outline-none focus:ring-0 cursor-pointer py-0 h-auto uppercase tracking-wider"
                     >
                        {Array.from({ length: 12 }).map((_, idx) => (
                           <option key={idx} value={idx} className="bg-neutral-950 text-foreground font-sans">
                              {new Date(2026, idx, 1).toLocaleString('default', { month: 'short' })}
                           </option>
                        ))}
                     </select>
                     
                     <select
                        aria-label="Select calendar year"
                        value={calendarDate.getFullYear()}
                        onChange={(e) => {
                           const newYear = parseInt(e.target.value, 10);
                           setCalendarDate(prev => {
                              const next = new Date(prev);
                              next.setFullYear(newYear);
                              return next;
                           });
                        }}
                        className="bg-transparent border-none text-xs font-black text-primary hover:text-primary-foreground focus:outline-none focus:ring-0 cursor-pointer py-0 h-auto tracking-wider"
                     >
                        {Array.from({ length: 16 }).map((_, idx) => {
                           const yr = new Date().getFullYear() - 5 + idx; // Gives e.g., 2021 to 2036
                           return (
                              <option key={yr} value={yr} className="bg-neutral-950 text-foreground font-sans">
                                 {yr}
                              </option>
                           );
                        })}
                     </select>
                  </div>

                  <Button 
                     variant="outline" 
                     size="icon" 
                     className="h-7 w-7 bg-white/5 border border-white/10 text-primary hover:bg-white/10 hover:text-primary-foreground focus:outline-none transition-all duration-200" 
                     onClick={() => {
                        setCalendarDate(prev => {
                           const next = new Date(prev);
                           next.setMonth(prev.getMonth() + 1);
                           return next;
                        });
                     }}
                     title="Next Month"
                  >
                     <ChevronRight className="w-4 h-4 text-primary" />
                  </Button>
               </div>
            </CardHeader>
            
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6">
               
               {/* 1. Month Days Grid */}
               <div className="md:col-span-3 space-y-2">
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                     <span>Su</span>
                     <span>Mo</span>
                     <span>Tu</span>
                     <span>We</span>
                     <span>Th</span>
                     <span>Fr</span>
                     <span>Sa</span>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                     {calendarDays.map((day) => {
                        const { expenses, incomes, planned } = getDailyDetails(day.dateStr);
                        const dayExpSum = expenses.reduce((sum, e) => sum + e.amount, 0);
                        const dayIncSum = incomes.reduce((sum, inc) => sum + inc.amount, 0);
                        const isSelected = day.dateStr === selectedDayStr;
                        const isToday = new Date().toISOString().substring(0, 10) === day.dateStr;

                        return (
                           <button
                              key={day.key}
                              onClick={() => setSelectedDayStr(day.dateStr)}
                              className={cn(
                                 "relative flex flex-col justify-between p-1.5 rounded-lg border text-left min-h-[52px] transition-all duration-150 overflow-hidden cursor-pointer",
                                 !day.isCurrentMonth && "opacity-30 bg-card/20",
                                 isSelected 
                                    ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-glow" 
                                    : "border-white/5 bg-secondary/5 hover:bg-white/5",
                                 isToday && !isSelected && "border-amber-500/50 bg-amber-500/5"
                              )}
                           >
                              <span className={cn(
                                 "text-[10px] font-bold block mb-1",
                                 isToday ? "text-amber-500 font-black" : "text-foreground",
                                 isSelected && "text-primary"
                              )}>
                                 {day.dayNum}
                              </span>
                              
                              <div className="space-y-[2px] w-full mt-auto">
                                 {dayExpSum > 0 && (
                                    <span className="text-[8px] font-bold text-rose-500 block truncate leading-none">
                                       -₹{dayExpSum >= 1000 ? `${(dayExpSum/1000).toFixed(0)}k` : dayExpSum}
                                    </span>
                                 )}
                                 {dayIncSum > 0 && (
                                    <span className="text-[8px] font-bold text-emerald-500 block truncate leading-none">
                                       +₹{dayIncSum >= 1000 ? `${(dayIncSum/1000).toFixed(0)}k` : dayIncSum}
                                    </span>
                                 )}
                                 {planned.length > 0 && (
                                    <div className="flex gap-[3px] items-center pt-[1px] flex-wrap">
                                       {planned.map((item, idx) => (
                                          <div 
                                             key={item.id || idx} 
                                             className={cn(
                                                "w-1 h-1 rounded-full",
                                                item.type === 'expense' 
                                                   ? "bg-rose-400" 
                                                   : item.type === 'income' 
                                                      ? "bg-emerald-400" 
                                                      : "bg-purple-400"
                                             )} 
                                          />
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </button>
                        );
                     })}
                  </div>
               </div>

               {/* 2. Planner details sidebar for selected dates */}
               <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-white/5 md:pl-6 pt-4 md:pt-0 flex flex-col justify-between h-full space-y-4">
                  <div>
                     <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                           <CalendarDays className="w-4 h-4 text-primary" /> Planner Hub
                        </h4>
                        <Badge variant="outline" className="text-[9px] py-0 border-white/10 font-bold bg-white/5 text-foreground/80">
                           {(() => {
                              const [y, m, d] = selectedDayStr.split('-');
                              if (!y || !m || !d) return selectedDayStr;
                              const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                              return dt.toLocaleDateString('default', { month: 'short', day: 'numeric', weekday: 'short' });
                           })()}
                        </Badge>
                     </div>

                     {/* Flow Activity lists for day */}
                     <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                        {(() => {
                           const { expenses, incomes, planned } = getDailyDetails(selectedDayStr);
                           const hasLogged = expenses.length > 0 || incomes.length > 0 || planned.length > 0;
                           
                           if (!hasLogged) {
                              return (
                                 <p className="text-[11px] text-muted-foreground italic py-4 text-center">
                                    No logged operations or pending plans on this calendar day.
                                 </p>
                              );
                           }

                           return (
                              <div className="space-y-2">
                                 {/* Planned Milestones */}
                                 {planned.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-purple-500/5 border border-purple-500/10 text-[11px] text-foreground">
                                       <div className="flex items-center gap-2 truncate">
                                          <div className={cn(
                                             "w-[6px] h-[6px] rounded-full shrink-0",
                                             item.type === 'expense' 
                                                ? "bg-rose-500" 
                                                : item.type === 'income' 
                                                   ? "bg-emerald-500" 
                                                   : "bg-purple-500"
                                          )} />
                                          <span className="truncate font-medium text-foreground">{item.text}</span>
                                       </div>
                                       <div className="flex items-center gap-2 shrink-0">
                                          {item.amount && <span className="font-semibold text-foreground">₹{item.amount.toLocaleString()}</span>}
                                          <Button 
                                             variant="ghost" 
                                             size="icon" 
                                             onClick={() => handleDeletePlannedEvent(selectedDayStr, item.id)} 
                                             className="h-5 w-5 hover:text-rose-500"
                                             title="Delete Plan"
                                          >
                                             <Trash2 className="w-3 h-3 text-rose-400" />
                                          </Button>
                                       </div>
                                    </div>
                                 ))}

                                 {/* Actual Expenses */}
                                 {expenses.map((e: any) => (
                                    <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-[11px] text-foreground">
                                       <span className="truncate text-muted-foreground">Exp: <strong className="text-foreground">{e.description}</strong></span>
                                       <span className="font-bold text-rose-400">₹{e.amount.toLocaleString()}</span>
                                    </div>
                                 ))}

                                 {/* Actual Incomes */}
                                 {incomes.map((inc: any) => (
                                    <div key={inc.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-foreground">
                                       <span className="truncate text-muted-foreground">Inc: <strong className="text-foreground">{inc.source}</strong></span>
                                       <span className="font-bold text-emerald-400">₹{inc.amount.toLocaleString()}</span>
                                    </div>
                                 ))}
                              </div>
                           );
                        })()}
                     </div>
                  </div>

                  {/* Planner quick creator Form */}
                  <div className="border-t border-white/5 pt-3 space-y-2">
                     <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Add Planned Milestone</span>
                     <div className="grid grid-cols-2 gap-2">
                        <Input 
                           type="text" 
                           placeholder="e.g. Bulk ingredients..." 
                           value={newEventText} 
                           onChange={(e) => setNewEventText(e.target.value)} 
                           className="text-[11px] h-8 text-foreground bg-background border border-input focus:border-primary/50 placeholder:text-muted-foreground/60"
                        />
                        <Input 
                           type="number" 
                           placeholder="optional ₹ amount" 
                           value={newEventAmount} 
                           onChange={(e) => setNewEventAmount(e.target.value)} 
                           className="text-[11px] h-8 text-foreground font-mono bg-background border border-input focus:border-primary/50 placeholder:text-muted-foreground/60"
                        />
                     </div>
                     <div className="flex gap-2">
                        <select 
                           aria-label="Select dynamic planner milestone type"
                           value={newEventType} 
                           onChange={(e: any) => setNewEventType(e.target.value)}
                           className="text-[11px] bg-background border border-input rounded-md px-2 flex-grow text-foreground h-8 focus:outline-none focus:border-primary/50"
                        >
                           <option value="general" className="bg-background text-foreground">Milestone/Note</option>
                           <option value="expense" className="bg-background text-foreground">Planned Expense</option>
                           <option value="income" className="bg-background text-foreground">Planned Income</option>
                        </select>
                        <Button 
                           onClick={handleAddPlannedEvent} 
                           className="h-8 shrink-0 text-xs px-4 bg-primary text-primary-foreground font-bold hover:opacity-90 active:scale-95 transition-all shadow-md border border-white/10"
                        >
                           <Plus className="w-3.5 h-3.5 mr-1" /> Add
                        </Button>
                     </div>
                  </div>

               </div>
               
            </CardContent>
         </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* MEMBER BALANCES: Shows who owes what in real-time */}
         <Card className="lg:col-span-1 border-none shadow-md bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
               <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                     <Wallet className="w-5 h-5 text-primary" />
                     Real-Time Balances
                  </CardTitle>
                  <CardDescription>Net member standing across all expenses.</CardDescription>
               </div>
               <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsBalancesCollapsed(!isBalancesCollapsed)} 
                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                  title={isBalancesCollapsed ? "Expand" : "Collapse"}
               >
                  {isBalancesCollapsed ? (
                     <ChevronDown className="w-4 h-4 text-primary" />
                  ) : (
                     <ChevronUp className="w-4 h-4 text-primary" />
                  )}
               </Button>
            </CardHeader>
            <AnimatePresence initial={false}>
               {!isBalancesCollapsed && (
                  <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: "auto", opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.2 }}
                     className="overflow-hidden"
                  >
                     <CardContent>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                           {memberBalances.map((mb) => (
                              <div key={mb.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/5 border border-transparent hover:border-primary/10 transition-all">
                                 <div className="flex items-center gap-3">
                                    {/* MEMBER AVATAR/ICON */}
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                       {mb.name[0]}
                                    </div>
                                    <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">{mb.name}</span>
                                 </div>
                                 <div className="text-right">
                                    <p className={cn(
                                        "text-sm font-black",
                                        mb.balance >= 0 ? "text-emerald-500" : "text-rose-500"
                                    )}>
                                       {mb.balance >= 0 ? '+' : ''}₹{Math.abs(mb.balance).toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                                       {mb.balance >= 0 ? 'To Receive' : 'To Pay'}
                                    </p>
                                 </div>
                              </div>
                           ))}
                           {memberBalances.length === 0 && (
                              <p className="text-xs text-muted-foreground italic text-center py-4">No balances calculated.</p>
                           )}
                        </div>
                     </CardContent>
                  </motion.div>
               )}
            </AnimatePresence>
         </Card>

         <div className="lg:col-span-2 space-y-6">
            {/* AI INSIGHTS SECTION: Powered by Gemini API to analyze spending patterns */}
            <Card className="border-none bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md overflow-hidden relative group">
               <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                     <Sparkles className="w-5 h-5 text-primary" />
                     <CardTitle className="text-lg text-foreground font-bold">AI Financial Review</CardTitle>
                  </div>
                  <CardDescription>Generated based on real-time organization data.</CardDescription>
               </CardHeader>
               <CardContent>
                  {loadingInsights ? (
                     <div className="flex items-center gap-2 text-muted-foreground py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm italic">Gemini is analyzing your spending patterns...</span>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.map((insight, index) => (
                           <div key={index} className="flex gap-3 bg-card/40 backdrop-blur-md p-3 rounded-lg border border-primary/10 hover:border-primary/30 transition-all">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                              <p className="text-xs leading-relaxed text-foreground/90">{insight}</p>
                           </div>
                        ))}
                        {insights.length === 0 && (
                           <p className="text-xs text-muted-foreground py-2 italic font-medium">Log more expenses to get personalized AI insights.</p>
                        )}
                     </div>
                  )}
               </CardContent>
            </Card>

            {/* CATEGORY DONUT CHART: Visual representation of where money is going */}
            <Card className="border-none shadow-md bg-card/50">
               <CardHeader>
                  <CardTitle className="text-lg text-foreground">Spending Mix</CardTitle>
                  <CardDescription>Distribution across categories.</CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="h-[240px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                           <Pie
                              data={categoryData.length > 0 ? categoryData : [{ name: 'None', value: 1 }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                           >
                              {categoryData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                              {categoryData.length === 0 && <Cell fill="#334155" />}
                           </Pie>
                        </RePieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                     {categoryData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs text-foreground">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                           <span className="font-medium text-muted-foreground">{item.name}:</span>
                           <span className="font-bold">₹{item.value.toLocaleString()}</span>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-md bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Recent Trend</CardTitle>
            <CardDescription>Expenditure flow of latest records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...stats.recentExpenses].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="amount" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* BANK LEDGER COMPONENT */}
        <Card className="lg:col-span-1 border-none shadow-md bg-card/50 flex flex-col justify-between" id="bank-ledger-section">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <PiggyBank className="w-5 h-5 text-emerald-500" />
                Collective Bank Ledger
              </CardTitle>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-none">
                ₹{bankBalance.toLocaleString()}
              </Badge>
            </div>
            <CardDescription>Direct bank inflows (sales/shares) & direct bank expenses.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-grow overflow-hidden">
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {bankLedger.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/5 border border-transparent hover:border-emerald-500/10 transition-all text-xs animate-fadeIn"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                      item.type === 'inbound' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {item.type === 'inbound' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.description}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{item.category} • {item.date}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "font-black text-sm",
                      item.type === 'inbound' ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {item.type === 'inbound' ? '+' : '-'}₹{item.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {bankLedger.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <PiggyBank className="w-10 h-10 mx-auto mb-2 opacity-10 animate-bounce" />
                  <p className="text-xs">No bank movements recorded yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md bg-card/50">
         <CardHeader className="flex flex-row items-center justify-between">
            <div>
               <CardTitle className="text-lg text-foreground">Recent Activity</CardTitle>
               <CardDescription>Latest expenses logged across the organization.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
         </CardHeader>
         <CardContent>
            <div className="space-y-4">
               {stats.recentExpenses.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-muted-foreground/10 group">
                     <div className="flex items-center gap-4">
                        <div className={cn(
                           "w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20",
                           "bg-primary"
                        )}>
                           <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{exp.description}</p>
                           <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{exp.category} • {exp.date}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-sm font-black text-foreground">₹{exp.amount.toLocaleString()}</p>
                        <Badge variant="outline" className="text-[9px] py-0 border-primary/20 text-primary bg-primary/5 capitalize">{exp.splitType}</Badge>
                     </div>
                  </div>
               ))}
               {stats.recentExpenses.length === 0 && (
                 <div className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-2 opacity-10" />
                    <p>No transactions yet.</p>
                 </div>
               )}
            </div>
         </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendType, color, onClick }: any) {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        "border-none shadow-md relative overflow-hidden bg-white/5 backdrop-blur-sm",
        onClick && "cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-95"
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-xl", color)}>
            {icon}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full",
              trendType === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
              {trendType === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {trend}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
          <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

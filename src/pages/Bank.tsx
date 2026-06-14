import * as React from 'react';
import { 
  Building, 
  Receipt, 
  ArrowUpRight, 
  ArrowDownRight, 
  Loader2, 
  CheckCircle2, 
  Wallet, 
  AlertCircle, 
  PiggyBank,
  Check,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Pencil,
  Info
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Income {
  id: string;
  source: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  submittedToBank?: boolean;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  notes?: string;
}

export function BankPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.email === 'bibekdeka97@gmail.com';

  const [incomes, setIncomes] = React.useState<Income[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'inbound' | 'outbound'>('all');
  const [depositingId, setDepositingId] = React.useState<string | null>(null);

  // States for expandable calculations sheet
  const [isExpanded, setIsExpanded] = React.useState(false);

  // States for transaction editing
  const [editingItem, setEditingItem] = React.useState<{ type: 'inbound' | 'outbound'; id: string } | null>(null);
  const [editSource, setEditSource] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editCategory, setEditCategory] = React.useState('');
  const [editDate, setEditDate] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');
  const [editSubmittedToBank, setEditSubmittedToBank] = React.useState(true);
  const [editPaidBy, setEditPaidBy] = React.useState('bank');
  const [savingEdit, setSavingEdit] = React.useState(false);

  React.useEffect(() => {
    // 1. Listen to Incomes
    const unsubIncomes = onSnapshot(collection(db, 'incomes'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
      setIncomes(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incomes'));

    // 2. Listen to Expenses
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    // 3. Listen to Members
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    return () => {
      unsubIncomes();
      unsubExpenses();
      unsubMembers();
    };
  }, []);

  // Bank balance details including all contributing transaction arrays and sums
  const bankBalanceDetails = React.useMemo(() => {
    // Inbound resources contributing to the bank balance (submittedToBank != false)
    const verifiedInbounds = incomes.filter(inc => inc.submittedToBank !== false);
    const totalInbounds = verifiedInbounds.reduce((sum, inc) => sum + (inc.amount || 0), 0);

    // Outbound withdrawals from bank (paidBy === 'bank')
    const verifiedOutbounds = expenses.filter(exp => exp.paidBy === 'bank');
    const totalOutbounds = verifiedOutbounds.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const calculatedBalance = totalInbounds - totalOutbounds;

    return {
      verifiedInbounds,
      totalInbounds,
      verifiedOutbounds,
      totalOutbounds,
      calculatedBalance
    };
  }, [incomes, expenses]);

  // Unified verified bank balance
  const bankBalance = bankBalanceDetails.calculatedBalance;

  // Amount to be deposited: cash incomes that are not yet submitted to the bank
  const amountToBeDeposited = React.useMemo(() => {
    return incomes
      .filter(inc => inc.submittedToBank === false)
      .reduce((sum, inc) => sum + (inc.amount || 0), 0);
  }, [incomes]);

  // Total Outbounds paid by bank
  const bankOutboundsTotal = bankBalanceDetails.totalOutbounds;

  // Bank passbook ledger: compiled list of all active bank transactions
  const bankLedger = React.useMemo(() => {
    const inbound = incomes
      .filter(inc => inc.submittedToBank !== false)
      .map(inc => ({
        id: inc.id,
        type: 'inbound' as const,
        description: inc.source,
        amount: inc.amount || 0,
        date: inc.date,
        category: inc.category,
        notes: inc.notes || 'Group dividend/income'
      }));

    const outbound = expenses
      .filter(exp => exp.paidBy === 'bank')
      .map(exp => ({
        id: exp.id,
        type: 'outbound' as const,
        description: exp.description,
        amount: exp.amount || 0,
        date: exp.date,
        category: exp.category,
        notes: exp.notes || 'Collective utility/expense'
      }));

    const compiled = [...inbound, ...outbound]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (filter === 'inbound') return compiled.filter(t => t.type === 'inbound');
    if (filter === 'outbound') return compiled.filter(t => t.type === 'outbound');
    return compiled;
  }, [incomes, expenses, filter]);

  // Income records pending deposit
  const pendingDeposits = React.useMemo(() => {
    return incomes
      .filter(inc => inc.submittedToBank === false)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incomes]);

  const handleConfirmDeposit = async (incomeId: string, amount: number, source: string) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can confirm deposit verification.");
      return;
    }
    setDepositingId(incomeId);
    try {
      await updateDoc(doc(db, 'incomes', incomeId), {
        submittedToBank: true,
        updatedAt: Date.now(),
        updatedByName: user?.displayName || user?.email || "Admin"
      });
      toast.success(`Successfully deposited ₹${amount.toLocaleString()} (${source}) to Bank!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incomes/${incomeId}`);
    } finally {
      setDepositingId(null);
    }
  };

  const startEdit = (type: 'inbound' | 'outbound', id: string) => {
    if (type === 'inbound') {
      const match = incomes.find(item => item.id === id);
      if (match) {
        setEditingItem({ type, id });
        setEditSource(match.source || '');
        setEditAmount(String(match.amount || 0));
        setEditCategory(match.category || 'General');
        setEditDate(match.date || new Date().toISOString().split('T')[0]);
        setEditNotes(match.notes || '');
        setEditSubmittedToBank(match.submittedToBank !== false);
      }
    } else {
      const match = expenses.find(item => item.id === id);
      if (match) {
        setEditingItem({ type, id });
        setEditSource(match.description || '');
        setEditAmount(String(match.amount || 0));
        setEditCategory(match.category || 'General');
        setEditDate(match.date || new Date().toISOString().split('T')[0]);
        setEditNotes(match.notes || '');
        setEditPaidBy(match.paidBy || 'bank');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can edit bank ledger transactions.");
      return;
    }
    if (!editingItem) return;
    setSavingEdit(true);

    try {
      const parsedAmount = parseFloat(editAmount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        toast.error("Please enter a valid positive number for the amount.");
        setSavingEdit(false);
        return;
      }

      if (editingItem.type === 'inbound') {
        const updatePayload = {
          source: editSource,
          amount: parsedAmount,
          category: editCategory,
          date: editDate,
          notes: editNotes,
          submittedToBank: editSubmittedToBank,
          updatedAt: Date.now(),
          updatedBy: user?.uid || "Admin",
          updatedByName: user?.displayName || user?.email || "Admin"
        };
        await updateDoc(doc(db, 'incomes', editingItem.id), updatePayload);
        toast.success(`Successfully updated Inbound income "${editSource}"`);
      } else {
        const updatePayload = {
          description: editSource,
          amount: parsedAmount,
          category: editCategory,
          date: editDate,
          notes: editNotes,
          paidBy: editPaidBy,
          updatedAt: Date.now(),
          updatedBy: user?.uid || "Admin",
          updatedByName: user?.displayName || user?.email || "Admin"
        };
        await updateDoc(doc(db, 'expenses', editingItem.id), updatePayload);
        toast.success(`Successfully updated Outbound expense "${editSource}"`);
      }
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${editingItem.type === 'inbound' ? 'incomes' : 'expenses'}/${editingItem.id}`);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building className="w-7 h-7 text-primary" /> Collective Bank Management
        </h2>
        <p className="text-muted-foreground text-sm">
          Track treasury bank reserves, manage actual deposits, and verify complete cash passbooks in real time.
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Bank Balance */}
        <Card className="bg-card border-none shadow-md overflow-hidden relative group flex flex-col justify-between">
          <div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardContent className="p-6 pb-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">
                    Verified Bank Balance
                  </p>
                  <h3 className="text-3xl font-black text-emerald-500 font-mono tracking-tight">
                    ₹{bankBalance.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <PiggyBank className="w-6 h-6" />
                </div>
              </div>
              <div className="pt-2 border-t border-dashed border-border flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Directly in treasury vault</span>
              </div>
            </CardContent>
          </div>
          <div className="p-6 pt-0">
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "w-full text-xs font-bold transition-all gap-1.5 h-8",
                isExpanded 
                  ? "bg-slate-700 hover:bg-slate-600 text-white" 
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {isExpanded ? (
                <>Hide Calculus Breakdown <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Expand & Verify Calculation <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </Button>
          </div>
        </Card>

        {/* Card 2: Amount to be Deposited */}
        <Card className="bg-card border-none shadow-md overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">
                  Amount to be Deposited
                </p>
                <h3 className="text-3xl font-black text-amber-500 font-mono tracking-tight">
                  ₹{amountToBeDeposited.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            <div className="pt-2 border-t border-dashed border-border flex items-center gap-2 text-xs text-muted-foreground">
              {amountToBeDeposited > 0 ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500 animate-bounce" />
                  <span className="text-amber-500 font-medium">{pendingDeposits.length} pending cash submissions</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-500">All cash accounts squared</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Bank Outflows */}
        <Card className="bg-card border-none shadow-md overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">
                  Total Bank Withdrawals
                </p>
                <h3 className="text-3xl font-black text-rose-500 font-mono tracking-tight">
                  ₹{bankOutboundsTotal.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
            <div className="pt-2 border-t border-dashed border-border flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">
                {expenses.filter(e => e.paidBy === 'bank').length}
              </span> 
              <span>expenses paid by collective fund</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expanded Calculations / Breakdown Sheet */}
      {isExpanded && (
        <Card className="bg-card border-none shadow-lg overflow-hidden animate-in slide-in-from-top-4 duration-300 relative border border-border/20">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500" />
          <CardHeader className="bg-secondary/15 pb-4 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-md font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                  Bank Ledger Reconciliation Breakdown
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs leading-relaxed">
                  The verified bank balance of <b>₹{bankBalance.toLocaleString()}</b> is computed strictly by compiling all bank-verified deposits minus treasury withdrawals.
                </CardDescription>
              </div>
              <div className="bg-muted/35 px-4 py-2.5 rounded-xl border border-border/50 font-mono text-center flex flex-col justify-center">
                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Formula Balance</span>
                <span className="text-sm font-black text-foreground">
                  ₹{bankBalanceDetails.totalInbounds.toLocaleString()} - ₹{bankBalanceDetails.totalOutbounds.toLocaleString()} = <span className="text-emerald-500">₹{bankBalanceDetails.calculatedBalance.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
              {/* Left Group: Inbounds list */}
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-lg">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-foreground font-sans">1. Total Inbound Verified Deposits</span>
                  </div>
                  <span className="text-sm font-black text-emerald-500 font-mono font-sans bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    +₹{bankBalanceDetails.totalInbounds.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                  {bankBalanceDetails.verifiedInbounds.length > 0 ? (
                    bankBalanceDetails.verifiedInbounds.map((inc) => (
                      <div key={inc.id} className="p-3 bg-muted/10 rounded-xl border border-border/40 hover:border-emerald-500/15 flex justify-between items-center gap-3 transition-all">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div>
                            <p className="text-xs font-bold text-foreground leading-snug truncate whitespace-nowrap">{inc.source}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="font-semibold text-emerald-500 bg-emerald-500/5 px-1.5 py-0.2 rounded border border-emerald-500/10 text-[9px]">{inc.category}</span>
                              <span>{inc.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs font-black font-mono text-emerald-500">+₹{inc.amount?.toLocaleString()}</span>
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEdit('inbound', inc.id)}
                              className="w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/45"
                              title="Edit Inbound Deposit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-6">No verified inbound deposits recorded!</p>
                  )}
                </div>
              </div>

              {/* Right Group: Outbounds list */}
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center bg-rose-500/5 p-3 rounded-xl border border-rose-500/20">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-500/20 text-rose-500 rounded-lg">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-foreground font-sans">2. Total Outbound Verified Withdrawals</span>
                  </div>
                  <span className="text-sm font-black text-rose-500 font-mono bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    -₹{bankBalanceDetails.totalOutbounds.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                  {bankBalanceDetails.verifiedOutbounds.length > 0 ? (
                    bankBalanceDetails.verifiedOutbounds.map((exp) => (
                      <div key={exp.id} className="p-3 bg-muted/10 rounded-xl border border-border/40 hover:border-rose-500/15 flex justify-between items-center gap-3 transition-all">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div>
                            <p className="text-xs font-bold text-foreground leading-snug truncate whitespace-nowrap">{exp.description}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="font-semibold text-rose-500 bg-rose-500/5 px-1.5 py-0.2 rounded border border-rose-500/10 text-[9px]">{exp.category}</span>
                              <span>{exp.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs font-black font-mono text-rose-500">-₹{exp.amount?.toLocaleString()}</span>
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => startEdit('outbound', exp.id)}
                              className="w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/45"
                              title="Edit Outbound Withdrawal"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-6">No outbound bank withdrawals recorded!</p>
                  )}
                </div>
              </div>
            </div>

            {/* Explanatory visual banner */}
            <div className="bg-secondary/20 p-4 border-t border-border/60 flex items-start gap-2.5 text-[11px] text-muted-foreground font-semibold leading-relaxed">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-foreground font-bold mb-0.5">Note on Bank Reconciliation:</p>
                <p>Transactions listed in these panels can be edited directly to correct amounts, dates, notes, categories, or payment routes. Adjusting an item will immediately re-calculate the treasury balance dynamically in real time.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Passbook / Ledger Column (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-none shadow-md">
            <CardHeader className="pb-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  Bank Passbook & Ledger
                </CardTitle>
                <CardDescription>
                  Detailed audit report of inbound deposits and ledger outlays.
                </CardDescription>
              </div>

              {/* Filtering Controls */}
              <div className="flex items-center gap-1.5 bg-secondary/30 p-1 rounded-lg border border-white/5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFilter('all')}
                  className={cn("h-7 text-xs px-3 font-semibold", filter === 'all' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground")}
                >
                  All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFilter('inbound')}
                  className={cn("h-7 text-xs px-3 font-semibold", filter === 'inbound' ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground hover:text-foreground")}
                >
                  Inbound
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFilter('outbound')}
                  className={cn("h-7 text-xs px-3 font-semibold", filter === 'outbound' ? "bg-rose-500/10 text-rose-500" : "text-muted-foreground hover:text-foreground")}
                >
                  Outbound
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {bankLedger.length > 0 ? (
                <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto no-scrollbar">
                  {bankLedger.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="p-4 hover:bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shrink-0"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2.5 rounded-lg shrink-0",
                          tx.type === 'inbound' 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : "bg-rose-500/10 text-rose-500"
                        )}>
                          {tx.type === 'inbound' ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-tight mb-1">{tx.description}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground font-semibold">
                            <span className="capitalize text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wide border border-primary/10">
                              {tx.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {tx.date}
                            </span>
                          </div>
                          {tx.notes && (
                            <p className="text-[11px] text-muted-foreground italic mt-1.5 bg-muted/10 p-2 rounded border border-border/20 max-w-sm">
                              {tx.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0 flex items-center gap-3">
                        <div>
                          <p className={cn(
                            "text-base font-black font-mono tracking-tight",
                            tx.type === 'inbound' ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {tx.type === 'inbound' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                          </p>
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest bg-muted/20 px-1.5 py-0.5 rounded border border-border/30">
                            {tx.type === 'inbound' ? 'Deposit' : 'Expense / Fund Out'}
                          </span>
                        </div>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => startEdit(tx.type, tx.id)}
                            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/45"
                            title="Edit transaction details"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center">
                    <Building className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-sm font-bold text-foreground">No Verified Transactions</p>
                    <p className="text-xs">No entries match your current filter selection inside this cooperative ledger.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Cash Deposits Column (1/3 width on desktop) */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card border-none shadow-md overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
            <CardHeader className="pb-3 border-b border-border/40 bg-amber-500/5">
              <CardTitle className="text-md flex items-center gap-2 text-foreground">
                <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                Deposit Cash Queue
              </CardTitle>
              <CardDescription className="text-amber-500/80 font-medium font-sans">
                Offline cash collections requiring physical deposit validation in the bank.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {pendingDeposits.length > 0 ? (
                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
                  {pendingDeposits.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-3 hover:border-amber-500/20 transition-all shrink-0"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs font-black text-foreground">{item.source}</p>
                          <p className="text-[10px] text-muted-foreground font-sans">Category: {item.category} • Date: {item.date}</p>
                        </div>
                        <span className="text-xs font-black text-amber-500 font-mono shrink-0">
                          ₹{item.amount.toLocaleString()}
                        </span>
                      </div>

                      {item.notes && (
                        <p className="text-[10px] text-muted-foreground bg-secondary/40 p-2 rounded border border-border/20 italic font-sans">
                          "{item.notes}"
                        </p>
                      )}

                      <Button 
                        disabled={!isAdmin || depositingId === item.id}
                        onClick={() => handleConfirmDeposit(item.id, item.amount, item.source)}
                        size="sm"
                        className="w-full text-[10px] h-8 bg-amber-500 text-neutral-900 font-bold hover:bg-amber-400 transition-colors gap-1.5"
                      >
                        {depositingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Confirm Bank Deposit
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 text-center font-sans">
                    <p className="text-xs font-bold text-foreground">All Cash Deposited</p>
                    <p className="text-[10px] text-muted-foreground max-w-[180px]">No pending offline cash transactions are awaiting deposit confirmation.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Edit Ledger Item Dialog */}
      <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-[460px] bg-card border-none text-foreground shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-indigo-505 animate-pulse" />
              Edit {editingItem?.type === 'inbound' ? 'Inbound Deposit' : 'Outbound Expense'}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              Modify the transaction details. Changing the amount or status will automatically recalculate the Verified Bank Balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Field: Name/Source */}
            <div className="space-y-1.5">
              <Label className="text-xs font-extrabold text-foreground">
                {editingItem?.type === 'inbound' ? 'Income Source Name' : 'Expense / Payment Description'}
              </Label>
              <Input 
                value={editSource} 
                onChange={(e) => setEditSource(e.target.value)} 
                type="text" 
                placeholder={editingItem?.type === 'inbound' ? 'e.g. Share sold, Sales, Service, etc.' : 'e.g. Domain renew, office furniture, etc.'}
                className="bg-muted/10 border-border/60 focus:border-indigo-500 text-sm h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Field: Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-foreground">Amount (INR)</Label>
                <Input 
                  value={editAmount} 
                  onChange={(e) => setEditAmount(e.target.value)} 
                  type="number" 
                  placeholder="e.g. 1000"
                  className="bg-muted/10 border-border/60 focus:border-indigo-500 font-mono text-sm h-10"
                />
              </div>

              {/* Field: Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-foreground">Transaction Date</Label>
                <Input 
                  value={editDate} 
                  onChange={(e) => setEditDate(e.target.value)} 
                  type="date" 
                  className="bg-muted/10 border-border/60 focus:border-indigo-500 text-sm h-10"
                />
              </div>
            </div>

            {/* Field: Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-extrabold text-foreground">Category</Label>
              <Input 
                value={editCategory} 
                onChange={(e) => setEditCategory(e.target.value)} 
                type="text" 
                placeholder="e.g. Share Premium, General, Utility, Sales"
                className="bg-muted/10 border-border/60 focus:border-indigo-500 text-sm h-10"
              />
            </div>

            {/* Conditional Type Fields */}
            {editingItem?.type === 'inbound' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-foreground">Deposit Status</Label>
                <Select 
                  value={editSubmittedToBank ? 'yes' : 'no'} 
                  onValueChange={(val) => setEditSubmittedToBank(val === 'yes')}
                >
                  <SelectTrigger className="bg-muted/10 border-border/60 focus:ring-indigo-500 text-sm h-10">
                    <SelectValue placeholder="Is it in the bank?" />
                  </SelectTrigger>
                  <SelectContent className="bg-card text-foreground">
                    <SelectItem value="yes">Deposited in Bank (Contributes to Bank Balance)</SelectItem>
                    <SelectItem value="no">Pending Offline Cash (Excluded from Bank Balance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-extrabold text-foreground">Payment Source</Label>
                <Select 
                  value={editPaidBy} 
                  onValueChange={(val) => setEditPaidBy(val)}
                >
                  <SelectTrigger className="bg-muted/10 border-border/60 focus:ring-indigo-500 text-sm h-10">
                    <SelectValue placeholder="Who paid this expense?" />
                  </SelectTrigger>
                  <SelectContent className="bg-card text-foreground">
                    <SelectItem value="bank">Collective Bank (Subtracts from Bank Balance)</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} (Member - Offline Cash Settlement)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-extrabold text-foreground font-sans">Audit / Transaction Notes</Label>
              <Textarea 
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)} 
                placeholder="Add audit trailing remarks or details."
                className="bg-muted/10 border-border/60 focus:border-indigo-500 min-h-[70px] text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border/40 pt-4 flex items-center justify-end font-sans">
            <Button 
              variant="outline" 
              onClick={() => setEditingItem(null)}
              className="border-border/60 text-muted-foreground hover:bg-secondary/45 font-semibold text-xs h-9"
            >
              Cancel
            </Button>
            <Button 
              disabled={savingEdit}
              onClick={handleSaveEdit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9"
            >
              {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

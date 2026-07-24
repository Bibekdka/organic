import * as React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Pencil, 
  Trash2, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  X, 
  PiggyBank, 
  Receipt, 
  Wallet, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Calendar,
  Filter
} from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type RecordTabType = 'bank_balance' | 'pending_deposits' | 'total_spent' | 'total_income' | 'cashflow' | 'members';

interface DashboardRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void; // eslint-disable-line no-unused-vars
  initialTab?: RecordTabType;
  allExpenses: any[];
  allIncomes: any[];
  members: any[];
  user: any;
  isAdmin: boolean;
}

export function DashboardRecordsModal({
  open,
  onOpenChange,
  initialTab = 'bank_balance',
  allExpenses,
  allIncomes,
  members,
  user,
  isAdmin
}: DashboardRecordsModalProps) {
  const [activeTab, setActiveTab] = React.useState<RecordTabType>(initialTab);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  // Editing state
  const [editingItem, setEditingItem] = React.useState<{
    id: string;
    collectionName: 'expenses' | 'incomes' | 'members';
    data: any;
  } | null>(null);

  const [editForm, setEditForm] = React.useState({
    title: '',
    amount: '',
    category: '',
    date: '',
    notes: '',
    paidBy: 'bank',
    submittedToBank: true
  });
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Deleting confirmation state
  const [deletingItem, setDeletingItem] = React.useState<{
    id: string;
    collectionName: 'expenses' | 'incomes' | 'members';
    title: string;
    amount?: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Depositing pending item state
  const [depositingId, setDepositingId] = React.useState<string | null>(null);

  // Sync initial tab when modal opens
  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setSelectedCategory('all');
      setEditingItem(null);
      setDeletingItem(null);
    }
  }, [open, initialTab]);

  // Derived records based on tab
  const records = React.useMemo(() => {
    if (activeTab === 'bank_balance') {
      const inbounds = allIncomes
        .filter(inc => inc.submittedToBank !== false && inc.submittedToBank !== 'no')
        .map(inc => ({
          id: inc.id,
          collectionName: 'incomes' as const,
          type: 'inbound' as const,
          title: inc.source || 'Income',
          amount: parseFloat(inc.amount) || 0,
          date: inc.date || '',
          category: inc.category || 'General',
          submittedToBank: true,
          notes: inc.notes || '',
          createdByName: inc.createdByName || 'System',
          raw: inc
        }));

      const outbounds = allExpenses
        .filter(exp => exp.paidBy === 'bank')
        .map(exp => ({
          id: exp.id,
          collectionName: 'expenses' as const,
          type: 'outbound' as const,
          title: exp.description || 'Expense',
          amount: parseFloat(exp.amount) || 0,
          date: exp.date || '',
          category: exp.category || 'General',
          paidBy: exp.paidBy,
          notes: exp.notes || '',
          createdByName: exp.createdByName || 'System',
          raw: exp
        }));

      return [...inbounds, ...outbounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (activeTab === 'pending_deposits') {
      return allIncomes
        .filter(inc => inc.submittedToBank === false || inc.submittedToBank === 'no')
        .map(inc => ({
          id: inc.id,
          collectionName: 'incomes' as const,
          type: 'inbound' as const,
          title: inc.source || 'Income',
          amount: parseFloat(inc.amount) || 0,
          date: inc.date || '',
          category: inc.category || 'General',
          submittedToBank: false,
          notes: inc.notes || '',
          createdByName: inc.createdByName || 'System',
          raw: inc
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (activeTab === 'total_spent') {
      return allExpenses
        .map(exp => ({
          id: exp.id,
          collectionName: 'expenses' as const,
          type: 'outbound' as const,
          title: exp.description || 'Expense',
          amount: parseFloat(exp.amount) || 0,
          date: exp.date || '',
          category: exp.category || 'General',
          paidBy: exp.paidBy || 'bank',
          splitType: exp.splitType || 'equal',
          notes: exp.notes || '',
          createdByName: exp.createdByName || 'System',
          raw: exp
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (activeTab === 'total_income') {
      return allIncomes
        .map(inc => ({
          id: inc.id,
          collectionName: 'incomes' as const,
          type: 'inbound' as const,
          title: inc.source || 'Income',
          amount: parseFloat(inc.amount) || 0,
          date: inc.date || '',
          category: inc.category || 'General',
          submittedToBank: inc.submittedToBank !== false && inc.submittedToBank !== 'no',
          notes: inc.notes || '',
          createdByName: inc.createdByName || 'System',
          raw: inc
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (activeTab === 'cashflow') {
      const inbounds = allIncomes.map(inc => ({
        id: inc.id,
        collectionName: 'incomes' as const,
        type: 'inbound' as const,
        title: inc.source || 'Income',
        amount: parseFloat(inc.amount) || 0,
        date: inc.date || '',
        category: inc.category || 'General',
        submittedToBank: inc.submittedToBank !== false && inc.submittedToBank !== 'no',
        notes: inc.notes || '',
        createdByName: inc.createdByName || 'System',
        raw: inc
      }));

      const outbounds = allExpenses.map(exp => ({
        id: exp.id,
        collectionName: 'expenses' as const,
        type: 'outbound' as const,
        title: exp.description || 'Expense',
        amount: parseFloat(exp.amount) || 0,
        date: exp.date || '',
        category: exp.category || 'General',
        paidBy: exp.paidBy || 'bank',
        notes: exp.notes || '',
        createdByName: exp.createdByName || 'System',
        raw: exp
      }));

      return [...inbounds, ...outbounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (activeTab === 'members') {
      return members.map(m => ({
        id: m.id,
        collectionName: 'members' as const,
        type: 'member' as const,
        title: m.name || 'Member',
        amount: m.shares ? parseFloat(m.shares) : 0,
        date: m.joinedDate || '',
        category: m.role || 'Member',
        email: m.email || '',
        raw: m
      }));
    }

    return [];
  }, [activeTab, allExpenses, allIncomes, members]);

  // Unique categories for filter dropdown
  const categoriesList = React.useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [records]);

  // Filtered records based on search and category filter
  const filteredRecords = React.useMemo(() => {
    return records.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.email && item.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [records, searchQuery, selectedCategory]);

  // Totals calculations
  const totalAmount = React.useMemo(() => {
    if (activeTab === 'bank_balance') {
      const inSum = records.filter(r => r.type === 'inbound').reduce((sum, r) => sum + r.amount, 0);
      const outSum = records.filter(r => r.type === 'outbound').reduce((sum, r) => sum + r.amount, 0);
      return inSum - outSum;
    }
    return records.reduce((sum, r) => sum + r.amount, 0);
  }, [records, activeTab]);

  // Handle Start Editing
  const handleStartEdit = (item: any) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Admin access required to edit records.");
      return;
    }
    setEditingItem({
      id: item.id,
      collectionName: item.collectionName,
      data: item.raw
    });
    setEditForm({
      title: item.title,
      amount: String(item.amount),
      category: item.category,
      date: item.date || new Date().toISOString().split('T')[0],
      notes: item.notes || '',
      paidBy: item.paidBy || 'bank',
      submittedToBank: item.submittedToBank ?? true
    });
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    if (!isAdmin || !editingItem) return;
    const parsedAmount = parseFloat(editForm.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }

    setIsSavingEdit(true);
    try {
      if (editingItem.collectionName === 'incomes') {
        const updatePayload = {
          source: editForm.title,
          amount: parsedAmount,
          category: editForm.category,
          date: editForm.date,
          notes: editForm.notes,
          submittedToBank: editForm.submittedToBank,
          updatedAt: Date.now(),
          updatedBy: user?.uid || 'Admin',
          updatedByName: user?.displayName || user?.email || 'Admin'
        };
        await updateDoc(doc(db, 'incomes', editingItem.id), updatePayload);
        toast.success(`Updated income record "${editForm.title}"`);
      } else if (editingItem.collectionName === 'expenses') {
        const updatePayload = {
          description: editForm.title,
          amount: parsedAmount,
          category: editForm.category,
          date: editForm.date,
          notes: editForm.notes,
          paidBy: editForm.paidBy,
          updatedAt: Date.now(),
          updatedBy: user?.uid || 'Admin',
          updatedByName: user?.displayName || user?.email || 'Admin'
        };
        await updateDoc(doc(db, 'expenses', editingItem.id), updatePayload);
        toast.success(`Updated expense record "${editForm.title}"`);
      }
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${editingItem.collectionName}/${editingItem.id}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Confirm Single Deposit
  const handleDepositItem = async (item: any) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only admins can confirm bank deposits.");
      return;
    }
    setDepositingId(item.id);
    try {
      await updateDoc(doc(db, 'incomes', item.id), {
        submittedToBank: true,
        updatedAt: Date.now(),
        updatedByName: user?.displayName || user?.email || "Admin"
      });
      toast.success(`Deposited ₹${item.amount.toLocaleString()} (${item.title}) to Bank!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incomes/${item.id}`);
    } finally {
      setDepositingId(null);
    }
  };

  // Handle Deposit All Pending
  const handleDepositAllPending = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only admins can confirm bank deposits.");
      return;
    }
    const pendingItems = records.filter(r => r.collectionName === 'incomes' && !r.submittedToBank);
    if (pendingItems.length === 0) {
      toast.info("No pending deposits found.");
      return;
    }

    setIsSavingEdit(true);
    try {
      for (const item of pendingItems) {
        await updateDoc(doc(db, 'incomes', item.id), {
          submittedToBank: true,
          updatedAt: Date.now(),
          updatedByName: user?.displayName || user?.email || "Admin"
        });
      }
      toast.success(`Successfully deposited all ${pendingItems.length} pending items to Bank!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'incomes');
      toast.error("Failed to deposit some items. Please check network.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete Doc
  const handleConfirmDelete = async () => {
    if (!isAdmin || !deletingItem) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, deletingItem.collectionName, deletingItem.id));
      toast.success(`Removed entry "${deletingItem.title}" successfully.`);
      setDeletingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${deletingItem.collectionName}/${deletingItem.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper title & icons for current tab header
  const getTabHeader = () => {
    switch (activeTab) {
      case 'bank_balance':
        return {
          title: 'Bank Balance Ledger',
          desc: 'Comprehensive records of all inbound deposits & outbound bank movements.',
          icon: <PiggyBank className="w-5 h-5 text-emerald-500" />,
          badgeBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        };
      case 'pending_deposits':
        return {
          title: 'Amount Pending Bank Deposit',
          desc: 'Incomes logged in hand or offline waiting to be deposited to the bank treasury.',
          icon: <TrendingUp className="w-5 h-5 text-amber-500" />,
          badgeBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
        };
      case 'total_spent':
        return {
          title: 'Total Expense Records',
          desc: 'All collective expenses and organizational payouts logged across the system.',
          icon: <Receipt className="w-5 h-5 text-rose-500" />,
          badgeBg: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
        };
      case 'total_income':
        return {
          title: 'Total Income & Revenue Records',
          desc: 'All share proceeds, sales, grants, and inbound revenues.',
          icon: <Wallet className="w-5 h-5 text-emerald-500" />,
          badgeBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        };
      case 'cashflow':
        return {
          title: 'Combined Cashflow Timeline',
          desc: 'Chronological timeline of all organizational revenues and expense transactions.',
          icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
          badgeBg: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
        };
      case 'members':
        return {
          title: 'Active Members Directory',
          desc: 'Current roster of active team members and share allocations.',
          icon: <Users className="w-5 h-5 text-primary" />,
          badgeBg: 'bg-primary/10 text-primary border-primary/20'
        };
    }
  };

  const headerInfo = getTabHeader();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 overflow-hidden text-foreground bg-background border-border shadow-2xl">
        {/* Header section with tabs */}
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl border", headerInfo.badgeBg)}>
                {headerInfo.icon}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {headerInfo.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {headerInfo.desc}
                </DialogDescription>
              </div>
            </div>

            {/* Total pill badge */}
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                {activeTab === 'bank_balance' ? 'Net Bank Balance' : activeTab === 'members' ? 'Total Units' : 'Total Value'}
              </span>
              <span className={cn(
                "text-base font-black font-mono tracking-tight",
                activeTab === 'total_spent' ? "text-rose-500" : "text-emerald-500"
              )}>
                {activeTab === 'members' ? `${totalAmount} Shares` : `₹${totalAmount.toLocaleString()}`}
              </span>
            </div>
          </div>

          {/* Navigation Tab Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-4 no-scrollbar border-t border-border/30 mt-3">
            {[
              { id: 'bank_balance' as const, label: 'Bank Balance', icon: <PiggyBank className="w-3.5 h-3.5" /> },
              { id: 'pending_deposits' as const, label: 'Left to Deposit', icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: 'total_spent' as const, label: 'Expenses', icon: <Receipt className="w-3.5 h-3.5" /> },
              { id: 'total_income' as const, label: 'Incomes', icon: <Wallet className="w-3.5 h-3.5" /> },
              { id: 'cashflow' as const, label: 'All Cashflow', icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: 'members' as const, label: 'Members', icon: <Users className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setEditingItem(null);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary/30 hover:bg-secondary/60 text-muted-foreground border-transparent"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Filter / Search Control Bar */}
        <div className="px-5 py-3 border-b border-border/40 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records..."
              className="pl-8 h-8 text-xs font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {categoriesList.length > 0 && (
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoriesList.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab === 'pending_deposits' && records.length > 0 && isAdmin && (
              <Button
                onClick={handleDepositAllPending}
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1 font-bold shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Deposit All to Bank
              </Button>
            )}
          </div>
        </div>

        {/* Main Records List Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[300px] max-h-[50vh]">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => {
              const isEditingThis = editingItem?.id === record.id;
              return (
                <div
                  key={record.id}
                  className={cn(
                    "rounded-xl border transition-all duration-200 overflow-hidden",
                    isEditingThis ? "border-indigo-500/50 bg-indigo-500/5 shadow-md" : "border-border/60 bg-card/40 hover:bg-card/70"
                  )}
                >
                  {/* Normal Row View */}
                  {!isEditingThis ? (
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0 mt-0.5",
                          record.type === 'inbound' ? "bg-emerald-500/10 text-emerald-500" :
                          record.type === 'outbound' ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                        )}>
                          {record.type === 'inbound' ? <ArrowUpRight className="w-4 h-4" /> :
                           record.type === 'outbound' ? <ArrowDownRight className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground leading-tight truncate">{record.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold capitalize border-border/60">
                              {record.category}
                            </Badge>
                            {record.date && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Calendar className="w-3 h-3 text-muted-foreground/70" /> {record.date}
                              </span>
                            )}
                            {record.collectionName === 'incomes' && (
                              <Badge variant="secondary" className={cn(
                                "text-[9px] py-0 px-1 font-bold",
                                record.submittedToBank ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              )}>
                                {record.submittedToBank ? 'Deposited in Bank' : 'Pending Deposit'}
                              </Badge>
                            )}
                            {record.collectionName === 'expenses' && record.paidBy && (
                              <span className="text-[10px] text-muted-foreground">
                                Paid by: <b className="text-foreground">{record.paidBy === 'bank' ? '🏦 Bank' : record.paidBy}</b>
                              </span>
                            )}
                          </div>
                          {record.notes && (
                            <p className="text-[11px] text-muted-foreground italic mt-1.5 bg-muted/20 px-2 py-1 rounded border border-border/20 max-w-md">
                              "{record.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Action & Amount Section */}
                      <div className="text-left sm:text-right shrink-0 flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                        <div>
                          <p className={cn(
                            "text-sm sm:text-base font-black font-mono tracking-tight",
                            record.type === 'inbound' ? "text-emerald-500" :
                            record.type === 'outbound' ? "text-rose-500" : "text-foreground"
                          )}>
                            {record.type === 'inbound' ? '+' : record.type === 'outbound' ? '-' : ''}
                            {record.type === 'member' ? `${record.amount} Shares` : `₹${record.amount.toLocaleString()}`}
                          </p>
                          {record.createdByName && (
                            <span className="text-[9px] text-muted-foreground block">by {record.createdByName}</span>
                          )}
                        </div>

                        {/* Control Action Buttons */}
                        <div className="flex items-center gap-1">
                          {activeTab === 'pending_deposits' && !record.submittedToBank && isAdmin && (
                            <Button
                              size="sm"
                              onClick={() => handleDepositItem(record)}
                              disabled={depositingId === record.id}
                              className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 shadow-sm"
                              title="Mark as deposited to bank"
                            >
                              {depositingId === record.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              <span>Deposit</span>
                            </Button>
                          )}

                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(record)}
                                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
                                title="Edit record details"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingItem({
                                  id: record.id,
                                  collectionName: record.collectionName,
                                  title: record.title,
                                  amount: record.amount
                                })}
                                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                                title="Remove / Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Inline Edit Panel */
                    <div className="p-4 space-y-3 bg-background/90 font-sans">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5" /> Edit Record Details
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingItem(null)}
                          className="w-6 h-6 rounded text-muted-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Title / Description</label>
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className="h-8 text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Amount (₹)</label>
                          <Input
                            type="number"
                            value={editForm.amount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                            className="h-8 text-xs font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Category</label>
                          <Input
                            value={editForm.category}
                            onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Transaction Date</label>
                          <Input
                            type="date"
                            value={editForm.date}
                            onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>

                        {editingItem.collectionName === 'incomes' && (
                          <div className="sm:col-span-2 flex items-center justify-between p-2 rounded bg-muted/20 border border-border/30">
                            <span className="text-xs font-medium text-foreground">Submitted & Deposited to Bank?</span>
                            <Button
                              type="button"
                              variant={editForm.submittedToBank ? "default" : "outline"}
                              size="sm"
                              onClick={() => setEditForm(prev => ({ ...prev, submittedToBank: !prev.submittedToBank }))}
                              className={cn("h-7 text-xs font-bold", editForm.submittedToBank && "bg-emerald-600 hover:bg-emerald-500 text-white")}
                            >
                              {editForm.submittedToBank ? 'Yes (Deposited)' : 'No (Pending)'}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Notes / Narrative</label>
                        <Input
                          value={editForm.notes}
                          onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Optional notes or audit explanation"
                          className="h-8 text-xs font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(null)}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                          size="sm"
                          className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 font-bold shadow-sm"
                        >
                          {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground space-y-2 border border-dashed rounded-xl bg-muted/5">
              <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold">No records found for this category.</p>
              <p className="text-xs text-muted-foreground">Try adjusting your search query or switching tabs.</p>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog Modal Overlay */}
        {deletingItem && (
          <Dialog open={!!deletingItem} onOpenChange={(isOpen) => !isOpen && setDeletingItem(null)}>
            <DialogContent className="sm:max-w-[400px] text-foreground">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-500">
                  <AlertCircle className="w-5 h-5" />
                  Confirm Entry Deletion
                </DialogTitle>
                <DialogDescription className="pt-2 text-xs leading-relaxed">
                  Are you sure you want to delete <b className="text-foreground">"{deletingItem.title}"</b>
                  {deletingItem.amount !== undefined && ` worth ₹${deletingItem.amount.toLocaleString()}`}?
                  This action will immediately update your database balance calculations.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingItem(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="h-8 text-xs gap-1.5 font-bold shadow-sm"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Permanently
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

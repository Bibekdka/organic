import * as React from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  AlertCircle,
  Trash2,
  PieChart,
  Users as UsersIcon,
  Loader2,
  Calendar,
  Repeat,
  FileSpreadsheet,
  FileDown,
  CheckCircle2
} from 'lucide-react';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from 'xlsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SplitType, Member } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';

import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';
import { Frequency } from '@/types';

export function ExpensesPage() {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [expenseList, setExpenseList] = React.useState<any[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('all');
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  // Form State
  const [amount, setAmount] = React.useState<number>(0);
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('Utility');
  const [paidBy, setPaidBy] = React.useState('');
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = React.useState<SplitType>('equal');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [frequency, setFrequency] = React.useState<Frequency>('monthly');
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
  const [manualSplits, setManualSplits] = React.useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [recurringTemplates, setRecurringTemplates] = React.useState<any[]>([]);

  // Fetch Data
  React.useEffect(() => {
    // Listen to Expenses
    const qExp = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      setExpenseList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    // Listen to Recurring Templates
    const qRec = query(collection(db, 'recurring_templates'), orderBy('description', 'asc'));
    const unsubRec = onSnapshot(qRec, (snapshot) => {
      setRecurringTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recurring_templates'));

    // Listen to Members
    const qMem = query(collection(db, 'members'));
    const unsubMem = onSnapshot(qMem, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(list);
      
      // Initialize selected members if empty
      setSelectedMemberIds(prev => prev.length === 0 ? list.map(m => m.id) : prev);
      
      setPaidBy(prev => {
        if (!prev && list.length > 0) return list[0].id;
        return prev;
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));

    return () => {
      unsubExp();
      unsubRec();
      unsubMem();
    };
  }, []);

  const handleSave = async () => {
    if (!isSplitValid || amount <= 0 || !description) {
      toast.error("Please fill all fields correctly");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const expenseData = {
        description,
        amount,
        category,
        paidBy,
        date,
        splitType,
        splits: splits.map(s => ({
          memberId: s.memberId,
          amount: parseFloat(s.amount.toFixed(2)),
          percentage: s.percentage ? parseFloat(s.percentage.toFixed(2)) : undefined
        })),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
        isRecurring
      };

      await addDoc(collection(db, 'expenses'), expenseData);

      if (isRecurring) {
        // Also save as template
        await addDoc(collection(db, 'recurring_templates'), {
          ...expenseData,
          frequency,
          nextExecutionDate: Date.now() + (frequency === 'monthly' ? 30 : 7) * 24 * 60 * 60 * 1000, // simple calc
          active: true
        });
      }

      toast.success("Expense logged successfully");
      setIsAddOpen(false);
      setAmount(0);
      setDescription('');
      setIsRecurring(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Organic-O-Eats - Expense Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = filteredExpenses.map(exp => [
      exp.description,
      `₹${exp.amount.toLocaleString()}`,
      exp.date,
      members.find(m => m.id === exp.paidBy)?.name || exp.paidBy,
      exp.category
    ]);

    (doc as any).autoTable({
      head: [['Description', 'Amount', 'Date', 'Paid By', 'Category']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`expenses_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredExpenses.map(exp => ({
      Description: exp.description,
      Amount: exp.amount,
      Date: exp.date,
      PaidBy: members.find(m => m.id === exp.paidBy)?.name || exp.paidBy,
      Category: exp.category,
      SplitType: exp.splitType
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm('Permanently delete this expense record?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success('Expense record removed');
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const splits = React.useMemo(() => {
    if (amount <= 0 || selectedMemberIds.length === 0) return [];

    const selectedMembers = members.filter(m => selectedMemberIds.includes(m.id));

    if (splitType === 'equal') {
      const perMember = amount / selectedMemberIds.length;
      return selectedMemberIds.map(id => ({ memberId: id, amount: perMember }));
    }

    if (splitType === 'shares') {
      const totalShares = selectedMembers.reduce((sum, m) => sum + ((m as any).shares || 0), 0);
      if (totalShares === 0) return selectedMemberIds.map(id => ({ memberId: id, amount: 0 }));
      return selectedMembers.map(m => {
        const share = (m as any).shares || 0;
        return {
          memberId: m.id,
          amount: (share / totalShares) * amount,
          percentage: (share / totalShares) * 100
        };
      });
    }

    if (splitType === 'percentage') {
      return selectedMemberIds.map(id => {
        const pct = manualSplits[id] || 0;
        return {
          memberId: id,
          amount: (pct / 100) * amount,
          percentage: pct
        };
      });
    }

    if (splitType === 'custom') {
      return selectedMemberIds.map(id => ({
        memberId: id,
        amount: manualSplits[id] || 0
      }));
    }

    return [];
  }, [amount, splitType, selectedMemberIds, manualSplits, members]);

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleManualSplitChange = (id: string, val: string) => {
    const num = parseFloat(val) || 0;
    setManualSplits(prev => ({ ...prev, [id]: num }));
  };

  const totalSplitAmount = splits.reduce((sum, s) => sum + s.amount, 0);
  const isSplitValid = Math.abs(totalSplitAmount - amount) < 0.1;

  const filteredExpenses = expenseList.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalSpentAllTime = expenseList.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6 pb-20 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Expenses & Settlements</h2>
          <p className="text-muted-foreground text-sm">Real-time ledger with automated share-based splitting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 text-foreground">
                <FileDown className="w-4 h-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 text-foreground">
                <FileDown className="w-4 h-4 text-rose-500" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 text-foreground">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg shadow-primary/20 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Log Expense
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/50 border border-border/40 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Receipt className="w-4 h-4" /> All Expenses
            </TabsTrigger>
            <TabsTrigger value="recurring" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
              <Repeat className="w-4 h-4" /> Recurring
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-card/50">
          <CardContent className="p-6 text-foreground">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Receipt className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Total Expenditure</p>
                  <p className="text-xl font-black">₹{totalSpentAllTime.toLocaleString()}</p>
               </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-card/50 text-foreground">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <UsersIcon className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Active Participants</p>
                  <p className="text-xl font-black">{members.length} Members</p>
               </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-card/50">
          <CardContent className="p-6 text-foreground">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <PieChart className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Last Log</p>
                  <p className="text-xl font-black">
                     {expenseList[0]?.date || 'None'}
                  </p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search expenses..." 
              className="pl-10 h-11 bg-card border-none shadow-sm focus-visible:ring-primary text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
         <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 bg-card border-none shadow-sm text-foreground">
               <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Categories" />
               </div>
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">All Categories</SelectItem>
               <SelectItem value="Utility">Utility</SelectItem>
               <SelectItem value="Maintenance">Maintenance</SelectItem>
               <SelectItem value="Rent">Rent</SelectItem>
               <SelectItem value="Capital">Capital</SelectItem>
               <SelectItem value="Others">Others</SelectItem>
            </SelectContent>
         </Select>
         <Button variant="outline" className="h-11 bg-card border-none shadow-sm gap-2 text-foreground">
            <Calendar className="w-3.5 h-3.5" /> Date Filter
         </Button>
      </div>

      <div className="bg-card rounded-xl shadow-md border-none overflow-hidden relative min-h-[400px]">
        {loading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
        ) : null}
        
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="all" className="m-0">
            <ScrollArea className="w-full">
                <Table>
                 <TableHeader className="bg-muted/30">
                   <TableRow>
                     <TableHead>Description</TableHead>
                     <TableHead>Amount</TableHead>
                     <TableHead>Date</TableHead>
                     <TableHead>Paid By</TableHead>
                     <TableHead>Split</TableHead>
                     <TableHead>Category</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                     <TableRow key={expense.id} className="hover:bg-muted/50 border-b border-muted/10 transition-colors">
                       <TableCell className="font-semibold text-foreground">{expense.description}</TableCell>
                       <TableCell className="font-bold text-foreground font-mono">₹{expense.amount.toLocaleString()}</TableCell>
                       <TableCell className="text-xs text-muted-foreground">{expense.date}</TableCell>
                       <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                              {members.find(m => m.id === expense.paidBy)?.name[0] || 'U'}
                            </div>
                            <span className="text-xs text-foreground truncate max-w-[100px]">{members.find(m => m.id === expense.paidBy)?.name || expense.paidBy}</span>
                          </div>
                       </TableCell>
                       <TableCell>
                          <Badge variant="outline" className="text-[10px] font-medium border-primary/20 text-primary bg-primary/5 uppercase">
                            {expense.splitType}
                          </Badge>
                       </TableCell>
                       <TableCell>
                          <span className="text-xs px-2 py-1 bg-secondary/50 rounded-md text-foreground">{expense.category}</span>
                       </TableCell>
                       <TableCell className="text-right">
                          <Button onClick={() => deleteExpense(expense.id)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                       </TableCell>
                     </TableRow>
                   )) : (
                     <TableRow>
                       <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                         <div className="flex flex-col items-center gap-3">
                            <Receipt className="w-12 h-12 opacity-10" />
                            <p className="text-sm">No expenses records found matching your filters.</p>
                         </div>
                       </TableCell>
                     </TableRow>
                   )}
                 </TableBody>
                </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recurring" className="m-0 text-foreground">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Template Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringTemplates.length > 0 ? recurringTemplates.map((template) => (
                    <TableRow key={template.id} className="hover:bg-muted/50 border-b border-muted/10 transition-colors">
                      <TableCell className="font-semibold text-foreground">{template.description}</TableCell>
                      <TableCell className="font-bold text-foreground font-mono">₹{template.amount.toLocaleString()}</TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground">{template.frequency}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                         {new Date(template.nextExecutionDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.active ? 'default' : 'secondary'} className="text-[10px]">
                          {template.active ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-primary hover:text-primary/80">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Run Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground text-foreground">
                         <div className="flex flex-col items-center gap-3">
                            <Repeat className="w-12 h-12 opacity-10" />
                            <p className="text-sm">No recurring expense templates yet.</p>
                         </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log New Expense</DialogTitle>
            <DialogDescription>
              Record a cooperative purchase and define the allocation rules.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Amount (₹)</label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="text-foreground"
                  value={amount || ''} 
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full text-foreground bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Utility">Utility</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Capital">Capital</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-primary/20 bg-primary/5">
               <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                     <Repeat className="w-4 h-4 text-primary" />
                     <Label className="text-sm font-bold text-foreground">Recurring Expense</Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Save as a template for future periods.</p>
               </div>
               <div className="flex items-center gap-3">
                  {isRecurring && (
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                      <SelectTrigger className="h-8 w-28 text-[10px] uppercase font-bold bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Purpose / Description</label>
              <Input 
                placeholder="What was this for?" 
                className="text-foreground"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Payer (Member)</label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger className="text-foreground bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Date</label>
                <Input 
                  type="date" 
                  className="text-foreground"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-6 bg-secondary/5 border-border/40">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <PieChart className="w-4 h-4 text-primary" />
                    Allocation Method
                  </label>
                  <Select value={splitType} onValueChange={(v) => setSplitType(v as SplitType)}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-background text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal">Split Equally</SelectItem>
                      <SelectItem value="percentage">Percentage %</SelectItem>
                      <SelectItem value="shares">By Equity Shares</SelectItem>
                      <SelectItem value="custom">Manual Amount</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Involved Members</p>
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-[10px]"
                      onClick={() => setSelectedMemberIds(members.map(m => m.id))}
                    >
                      Select All
                    </Button>
                  </div>

                  <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {members.map((member) => (
                      <div key={member.id} className={cn(
                        "flex items-center justify-between gap-4 p-3 rounded-lg bg-card border transition-all h-14",
                        selectedMemberIds.includes(member.id) ? "border-primary/20 shadow-sm" : "border-transparent opacity-60"
                      )}>
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            id={`member-${member.id}`} 
                            checked={selectedMemberIds.includes(member.id)}
                            onCheckedChange={() => toggleMember(member.id)}
                          />
                          <div className="flex flex-col">
                            <label htmlFor={`member-${member.id}`} className="text-xs font-semibold cursor-pointer text-foreground">
                              {member.name}
                            </label>
                            <span className="text-[10px] text-muted-foreground font-mono">{(member as any).shares || 0} Units</span>
                          </div>
                        </div>

                        {selectedMemberIds.includes(member.id) && (
                          <div className="flex items-center gap-4 flex-1 justify-end">
                            <div className="hidden sm:block flex-1 max-w-[120px]">
                               <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary transition-all duration-500" 
                                    style={{ width: `${(splits.find(s => s.memberId === member.id)?.amount || 0) / (amount || 1) * 100}%` }}
                                  />
                               </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {(splitType === 'percentage' || splitType === 'custom') && (
                                <div className="relative w-24">
                                  <Input 
                                    className="h-8 pr-6 text-right text-xs bg-background border-muted focus-visible:ring-primary text-foreground"
                                    placeholder={splitType === 'percentage' ? '%' : '₹'}
                                    value={manualSplits[member.id] || ''}
                                    onChange={(e) => handleManualSplitChange(member.id, e.target.value)}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">
                                    {splitType === 'percentage' ? '%' : '₹'}
                                  </span>
                                </div>
                              )}
                              <div className="text-right min-w-[80px]">
                                <p className="text-xs font-black text-foreground">₹{splits.find(s => s.memberId === member.id)?.amount.toFixed(2) || '0.00'}</p>
                                {splits.find(s => s.memberId === member.id)?.percentage && (
                                  <p className="text-[10px] text-emerald-500 font-bold">{splits.find(s => s.memberId === member.id)?.percentage?.toFixed(1)}%</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
               </div>

               {!isSplitValid && amount > 0 && selectedMemberIds.length > 0 && (
                 <div className={cn(
                   "flex items-center gap-2 p-3 rounded-lg text-xs font-semibold",
                   totalSplitAmount > amount ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                 )}>
                   <AlertCircle className="w-4 h-4" />
                   {totalSplitAmount > amount 
                    ? `Over-allocated by ₹${(totalSplitAmount - amount).toFixed(2)}`
                    : `Short by ₹${(amount - totalSplitAmount).toFixed(2)}`
                   }
                 </div>
               )}
            </div>
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="text-foreground">Cancel</Button>
            <Button 
              disabled={!isSplitValid || amount <= 0 || isSubmitting}
              onClick={handleSave} 
              className="shadow-lg shadow-primary/20 px-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-foreground" />
                  Saving...
                </>
              ) : 'Confirm & Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


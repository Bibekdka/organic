import * as React from 'react';
import { 
  TrendingUp, 
  Plus, 
  Search, 
  MoreVertical, 
  Download, 
  Trash2, 
  Calendar,
  Filter,
  Loader2,
  DollarSign,
  ArrowUpRight,
  Pencil
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from 'xlsx';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Income } from '@/types';
import { cn, getUserAttribution, downloadPDFFile } from '@/lib/utils';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';
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
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/useAuthStore';

const INCOME_CATEGORIES = [
  'Sales',
  'Services',
  'Grants',
  'Donations',
  'Interest',
  'Other'
];

export function IncomesPage() {
  const [incomes, setIncomes] = React.useState<Income[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.email === 'bibekdeka97@gmail.com';

  // Form state
  const [editingIncome, setEditingIncome] = React.useState<Income | null>(null);
  const [source, setSource] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('Sales');
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submittedToBank, setSubmittedToBank] = React.useState<'yes' | 'no'>('yes');

  React.useEffect(() => {
    const q = query(collection(db, 'incomes'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setIncomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incomes'));

    return unsub;
  }, []);

  const handleSaveIncome = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    if (!source || !amount || !user) return;
    setIsSubmitting(true);
    const attr = getUserAttribution();
    try {
      const incomeData = {
        source,
        amount: parseFloat(amount),
        category,
        date,
        notes,
        submittedToBank: submittedToBank === 'yes'
      };

      if (editingIncome) {
        await updateDoc(doc(db, 'incomes', editingIncome.id), {
          ...incomeData,
          updatedAt: Date.now(),
          updatedBy: attr.userId,
          updatedByName: attr.userName
        });
        toast.success('Income record updated successfully');
      } else {
        await addDoc(collection(db, 'incomes'), {
          ...incomeData,
          createdAt: Date.now(),
          createdBy: attr.userId,
          createdByName: attr.userName,
          createdByDevice: attr.device
        });
        toast.success('Income recorded successfully');
      }
      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingIncome ? OperationType.UPDATE : OperationType.CREATE, 'incomes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingIncome(null);
    setSource('');
    setAmount('');
    setCategory('Sales');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setSubmittedToBank('yes');
  };

  const deleteIncome = async (id: string) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    if (!window.confirm('Delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'incomes', id));
      toast.success('Record deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `incomes/${id}`);
    }
  };

  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const amountToBeDeposited = incomes
    .filter(inc => inc.submittedToBank === false || inc.submittedToBank === 'no')
    .reduce((sum, inc) => sum + inc.amount, 0);

  const filteredIncomes = incomes.filter(inc => 
    inc.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportPDF = () => {
    if (filteredIncomes.length === 0) {
      toast.error("No data to export");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Organic-O-Eats - Income Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = filteredIncomes.map(inc => [
      inc.source,
      `₹${inc.amount.toLocaleString()}`,
      inc.date,
      inc.category,
      inc.submittedToBank === false ? 'Offline Cash' : 'Submitted to Bank',
      inc.notes || 'No description'
    ]);

    autoTable(doc, {
      head: [['Source', 'Amount', 'Date', 'Category', 'Bank Status', 'Notes']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] } // emerald-500 equivalent color
    });

    const reportName = `incomes_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDFFile(doc, reportName);
  };

  const handleExportExcel = () => {
    if (filteredIncomes.length === 0) {
      toast.error("No data to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredIncomes.map(inc => ({
      Source: inc.source,
      Amount: inc.amount,
      Date: inc.date,
      Category: inc.category,
      'Submitted to Bank': inc.submittedToBank === false ? 'No (Offline Cash)' : 'Yes',
      Notes: inc.notes || ''
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Incomes");
    XLSX.writeFile(wb, `incomes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            Income Tracking
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Record and monitor organization inflows.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" className="gap-2 bg-card border-none shadow-sm text-foreground">
                <Download className="w-4 h-4" /> Export
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-48 bg-card border border-border">
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 text-foreground cursor-pointer">
                <Download className="w-4 h-4 text-rose-500" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 text-foreground cursor-pointer">
                <Download className="w-4 h-4 text-emerald-500" /> Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button disabled={!isAdmin} onClick={() => setIsAddOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add Income
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-emerald-500 rounded-2xl p-6 text-white shadow-xl shadow-emerald-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <ArrowUpRight className="w-6 h-6 opacity-50" />
          </div>
          <div className="mt-8">
            <p className="text-white/70 text-xs font-black uppercase tracking-widest">Total Revenue</p>
            <h2 className="text-4xl font-black mt-2">₹{totalIncome.toLocaleString()}</h2>
          </div>
        </div>

        <div className="bg-amber-500 rounded-2xl p-6 text-white shadow-xl shadow-amber-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="mt-8">
            <p className="text-white/70 text-xs font-black uppercase tracking-widest">Amount to be Deposited</p>
            <h2 className="text-4xl font-black mt-2">₹{amountToBeDeposited.toLocaleString()}</h2>
          </div>
        </div>
        
        <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-8">
            <p className="text-muted-foreground text-xs font-black uppercase tracking-widest">This Month</p>
            <h2 className="text-4xl font-black mt-2 text-foreground">
              ₹{incomes.filter(inc => {
                const d = new Date(inc.date);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).reduce((sum, inc) => sum + inc.amount, 0).toLocaleString()}
            </h2>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Filter className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-8">
            <p className="text-muted-foreground text-xs font-black uppercase tracking-widest">Transactions</p>
            <h2 className="text-4xl font-black mt-2 text-foreground">{incomes.length}</h2>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search source or category..." 
            className="pl-10 h-11 bg-card border-none shadow-sm focus:ring-emerald-500 text-foreground"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-11 bg-card border-none shadow-sm text-foreground">
          <Filter className="w-4 h-4 mr-2" /> Categories
        </Button>
      </div>

      <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 border border-border/50 overflow-hidden relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        )}
        
        {/* Desktop View Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-none">
                <TableHead className="w-[300px] text-[10px] font-black uppercase tracking-widest px-6">Source</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Amount</TableHead>
                <TableHead className="w-[80px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncomes.map((income) => (
                <TableRow key={income.id} className="hover:bg-muted/10 transition-colors border-b border-border/40">
                  <TableCell className="px-6">
                    <div className="flex flex-col text-foreground">
                      <span className="font-bold text-sm">{income.source}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{income.notes || 'No description'}</span>
                        {income.createdByName && (
                          <span className="text-[9px] text-primary font-black uppercase italic tracking-tighter">By {income.createdByName}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] uppercase font-bold py-0 self-start">
                        {income.category}
                      </Badge>
                      {income.submittedToBank === false ? (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[8px] uppercase font-black py-0 px-1.5 self-start">
                          Offline Cash
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[8px] uppercase font-black py-0 px-1.5 self-start">
                          🏦 Submitted to Bank
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {income.date}
                  </TableCell>
                  <TableCell className="text-right font-black text-emerald-600">
                    ₹{income.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className={cn("w-8 h-8 text-muted-foreground hover:text-rose-500", !isAdmin && "hidden")}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingIncome(income);
                          setSource(income.source);
                          setAmount(income.amount.toString());
                          setCategory(income.category);
                          setDate(income.date);
                          setNotes(income.notes || '');
                          setSubmittedToBank(income.submittedToBank === false ? 'no' : 'yes');
                          setIsAddOpen(true);
                        }} className="cursor-pointer">
                           <Pencil className="w-4 h-4 mr-2 text-indigo-500" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteIncome(income.id)} className="text-rose-500 cursor-pointer">
                           <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredIncomes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                      <DollarSign className="w-12 h-12" />
                      <p className="font-black uppercase tracking-[0.2em] text-[10px]">No income records</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden divide-y divide-border/20">
          {filteredIncomes.map((income) => (
            <div key={income.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground leading-tight mb-1">{income.source}</h4>
                  <div className="flex flex-wrap gap-1.5 items-center mt-1">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] uppercase font-bold py-0">
                      {income.category}
                    </Badge>
                    {income.submittedToBank === false ? (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[8px] uppercase font-bold py-0">
                        Offline Cash
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[8px] uppercase font-bold py-0">
                        🏦 In Bank
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{income.date}</span>
                    {income.createdByName && (
                      <span className="text-[9px] text-primary font-black uppercase italic ml-1">By {income.createdByName}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">₹{income.amount.toLocaleString()}</p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <Button 
                      onClick={() => {
                        setEditingIncome(income);
                        setSource(income.source);
                        setAmount(income.amount.toString());
                        setCategory(income.category);
                        setDate(income.date);
                        setNotes(income.notes || '');
                        setSubmittedToBank(income.submittedToBank === false ? 'no' : 'yes');
                        setIsAddOpen(true);
                      }} 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-8 w-8 text-indigo-500", !isAdmin && "hidden")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button onClick={() => deleteIncome(income.id)} variant="ghost" size="icon" className={cn("h-8 w-8 text-rose-500", !isAdmin && "hidden")}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              {income.notes && (
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  {income.notes}
                </p>
              )}
            </div>
          ))}
          {!loading && filteredIncomes.length === 0 && (
            <div className="py-20 text-center text-muted-foreground italic text-xs uppercase tracking-widest font-black">
              Empty records
            </div>
          )}
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {editingIncome ? "Edit Income Record" : "Record Income"}
            </DialogTitle>
            <DialogDescription>
              {editingIncome ? "Modify the details of this inflow transaction." : "Manually add an inflow transaction to the records."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-muted-foreground">Source</label>
              <Input 
                placeholder="Product Sale, Donor Name..." 
                value={source} 
                onChange={(e) => setSource(e.target.value)}
                className="font-bold text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Amount (₹)</label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-black text-emerald-600"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase text-muted-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="font-bold text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-muted-foreground">Date</label>
              <Input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="font-mono text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-muted-foreground">Internal Notes</label>
              <Input 
                placeholder="Reference number or memo..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                className="text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                🏦 Submitted to Bank?
              </label>
              <Select value={submittedToBank} onValueChange={(v: 'yes' | 'no') => setSubmittedToBank(v)}>
                <SelectTrigger className="font-bold text-foreground bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes" className="font-bold text-emerald-600">Yes (Debited to Collective Bank Account)</SelectItem>
                  <SelectItem value="no" className="font-bold text-rose-500">No (Keep as cash/handover - does not put up to bank)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="text-foreground">Cancel</Button>
            <Button 
               onClick={handleSaveIncome} 
               disabled={!source || !amount || isSubmitting}
               className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-200"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

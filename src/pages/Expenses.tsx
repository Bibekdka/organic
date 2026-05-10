import * as React from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Member } from '@/types';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';

import { collection, query, onSnapshot, orderBy, deleteDoc, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';

export function ExpensesPage() {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [expenseList, setExpenseList] = React.useState<any[]>([]);
  const [recurringTemplates, setRecurringTemplates] = React.useState<any[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('all');
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

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
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));

    return () => {
      unsubExp();
      unsubRec();
      unsubMem();
    };
  }, []);

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

  const runRecurringTemplate = async (template: any) => {
    try {
      // eslint-disable-next-line no-unused-vars
      const { id, nextExecutionDate, active, frequency, createdAt, ...expenseData } = template;
      
      // 1. Log the expense
      await addDoc(collection(db, 'expenses'), {
        ...expenseData,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });

      // 2. Update the template's next execution date
      let daysToAdd = 30;
      if (frequency === 'daily') daysToAdd = 1;
      else if (frequency === 'weekly') daysToAdd = 7;
      else if (frequency === 'monthly') daysToAdd = 30;
      else if (frequency === 'yearly') daysToAdd = 365;

      await updateDoc(doc(db, 'recurring_templates', id), {
        nextExecutionDate: Date.now() + daysToAdd * 24 * 60 * 60 * 1000
      });

      toast.success('Recurring expense instance logged');
    } catch (error) {
      toast.error('Failed to run template');
      handleFirestoreError(error, OperationType.WRITE, `recurring_templates/${template.id}`);
    }
  };

  const filteredExpenses = expenseList.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalSpentAllTime = expenseList.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6 pb-20 px-4 sm:px-0">
      <AddExpenseDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Expenses & Settlements</h2>
          <p className="text-muted-foreground text-sm">Real-time ledger with automated share-based splitting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" className="gap-2 text-foreground">
                <FileDown className="w-4 h-4" /> Export
              </Button>
            } />
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
               <SelectItem value="Electricity">Electricity</SelectItem>
               <SelectItem value="Food">Food</SelectItem>
               <SelectItem value="Travel">Travel</SelectItem>
               <SelectItem value="Utility">Utility</SelectItem>
               <SelectItem value="Maintenance">Maintenance</SelectItem>
               <SelectItem value="Rent">Rent</SelectItem>
               <SelectItem value="Payroll">Payroll</SelectItem>
               <SelectItem value="Grocery">Grocery</SelectItem>
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
                        <Button 
                          onClick={() => runRecurringTemplate(template)}
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-2 text-primary hover:text-primary/80"
                        >
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
    </div>
  );
}


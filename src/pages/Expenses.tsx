import * as React from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Trash2,
  Pencil,
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
import autoTable from "jspdf-autotable";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Member } from '@/types';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';

import { collection, query, onSnapshot, orderBy, deleteDoc, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserAttribution, downloadPDFFile } from '@/lib/utils';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';

export function ExpensesPage() {
  // UI State: Controls dialog visibility and tab selection
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [expenseToEdit, setExpenseToEdit] = React.useState<any>(null);
  const [expenseToDelete, setExpenseToDelete] = React.useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = React.useState<string | null>(null);
  const [templateToEdit, setTemplateToEdit] = React.useState<any>(null);
  
  // Data State: Synchronized with Firestore collections
  const [expenseList, setExpenseList] = React.useState<any[]>([]);
  const [recurringTemplates, setRecurringTemplates] = React.useState<any[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('all');
  
  // UX State: Handles client-side searching and category filtering
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  /**
   * Data Layer: Real-time listeners for Firestore
   * - 'expenses': Main financial ledger
   * - 'recurring_templates': Rules for automated billing
   * - 'members': Source of truth for payer/payee identification
   */
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
      members.find(m => m.id === exp.paidBy)?.name || `User (${exp.paidBy.substring(0, 5)}...)`,
      exp.category
    ]);

    autoTable(doc, {
      head: [['Description', 'Amount', 'Date', 'Paid By', 'Category']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const reportName = `expenses_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDFFile(doc, reportName);
  };

  /**
   * Logical Operation: Excel Data Transformation & Download
   * Converts the filtered list into a format readable by spreadsheet software.
   */
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      toast.error("No data to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredExpenses.map(exp => ({
      Description: exp.description,
      Amount: exp.amount,
      Date: exp.date,
      PaidBy: members.find(m => m.id === exp.paidBy)?.name || `User (${exp.paidBy.substring(0, 5)}...)`,
      Category: exp.category,
      SplitType: exp.splitType
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  /**
   * Action: Delete an expense record
   * Triggered by the dustbin icon. Removes the record from Firestore.
   */
  const deleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete));
      toast.success('Expense record removed');
      setExpenseToDelete(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `expenses/${expenseToDelete}`);
    }
  };

  /**
   * UI Action: Setup editing for an existing expense
   * Fills the dialog state with data from the selected record.
   */
  const handleEditExpense = (expense: any) => {
    setTemplateToEdit(null);
    setExpenseToEdit(expense);
    setIsAddOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setExpenseToEdit(null);
    setTemplateToEdit(template);
    setIsAddOpen(true);
  };

  const openAddDialog = () => {
    setExpenseToEdit(null);
    setTemplateToEdit(null);
    setIsAddOpen(true);
  };

  /**
   * Action: Delete a recurring template
   */
  const deleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await deleteDoc(doc(db, 'recurring_templates', templateToDelete));
      toast.success('Recurring template removed');
      setTemplateToDelete(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `recurring_templates/${templateToDelete}`);
    }
  };

  /**
   * Logic: recurring expense executor
   * Manually triggers a template to log an expense immediately and updates the next scheduled date.
   */
  const runRecurringTemplate = async (template: any) => {
    const attr = getUserAttribution();
    try {
      // eslint-disable-next-line no-unused-vars
      const { id, nextExecutionDate, active, frequency, createdAt, ...expenseData } = template;
      
      // 1. Log the expense
      await addDoc(collection(db, 'expenses'), {
        description: expenseData.description || 'Recurring Expense Execution',
        amount: Number(expenseData.amount) || 0,
        category: expenseData.category || 'General',
        paidBy: expenseData.paidBy || '',
        splitType: expenseData.splitType || 'equal',
        splits: Array.isArray(expenseData.splits) ? expenseData.splits : [],
        isRecurring: expenseData.isRecurring !== undefined ? expenseData.isRecurring : true,
        ...expenseData,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        createdBy: attr.userId,
        createdByName: attr.userName,
        createdByDevice: attr.device
      });

      // 2. Update the template's next execution date
      let daysToAdd = 30;
      if (frequency === 'daily') daysToAdd = 1;
      else if (frequency === 'weekly') daysToAdd = 7;
      else if (frequency === 'monthly') daysToAdd = 30;
      else if (frequency === 'yearly') daysToAdd = 365;

      await updateDoc(doc(db, 'recurring_templates', id), {
        nextExecutionDate: Date.now() + daysToAdd * 24 * 60 * 60 * 1000,
        updatedByName: attr.userName,
        updatedByDevice: attr.device,
        updatedAt: serverTimestamp()
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
    <div className="space-y-6 pb-20 px-4 sm:px-0 text-foreground">
      <AddExpenseDialog 
        open={isAddOpen} 
        onOpenChange={setIsAddOpen} 
        initialData={expenseToEdit ? { ...expenseToEdit, _collection: 'expenses' } : templateToEdit ? { ...templateToEdit, _collection: 'recurring_templates' } : null}
      />
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
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 text-foreground cursor-pointer">
                <FileDown className="w-4 h-4 text-rose-500" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 text-foreground cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openAddDialog} className="gap-2 shadow-lg shadow-primary/20 w-full sm:w-auto">
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
               <SelectItem value="Misc">Misc</SelectItem>
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
            {/* Desktop View Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Paid By</TableHead>
                    <TableHead>Owner</TableHead>
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
                            {members.find(m => m.id === expense.paidBy)?.name[0] || '?'}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground truncate max-w-[100px]">
                              {members.find(m => m.id === expense.paidBy)?.name || `User (${expense.paidBy.substring(0, 5)}...)`}
                            </span>
                            {members.find(m => m.id === expense.paidBy)?.role && (
                              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">
                                {members.find(m => m.id === expense.paidBy)?.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-foreground truncate max-w-[80px]">
                              {expense.updatedByName || expense.createdByName || 'System'}
                           </span>
                           <span className="text-[8px] text-muted-foreground italic">
                              {expense.updatedByName ? 'Editor' : 'Creator'}
                           </span>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            onClick={() => handleEditExpense(expense)} 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            onClick={() => setExpenseToDelete(expense.id)} 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
            </div>

            {/* Mobile View Cards */}
            <div className="md:hidden divide-y divide-muted/10">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-tight mb-1">{expense.description}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-tighter bg-secondary/10 text-muted-foreground border-none">
                          {expense.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{expense.date}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-foreground">₹{expense.amount.toLocaleString()}</p>
                      <Badge variant="outline" className="text-[9px] h-4 border-primary/20 text-primary uppercase font-bold px-1 mt-1">
                        {expense.splitType}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                        {members.find(m => m.id === expense.paidBy)?.name[0] || '?'}
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[100px]">
                        Paid by {members.find(m => m.id === expense.paidBy)?.name || 'User'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end mr-4">
                       <span className="text-[9px] font-black text-foreground">By {expense.updatedByName || expense.createdByName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button onClick={() => handleEditExpense(expense)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => setExpenseToDelete(expense.id)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && (
                <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Receipt className="w-10 h-10 opacity-10" />
                  <p className="text-sm italic">Nothing found.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recurring" className="m-0 text-foreground">
            {/* Desktop View Table */}
            <div className="hidden md:block">
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
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            onClick={() => handleEditTemplate(template)}
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            onClick={() => setTemplateToDelete(template.id)}
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            onClick={() => runRecurringTemplate(template)}
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-2 text-primary hover:text-primary/80"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Run Now
                          </Button>
                        </div>
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
            </div>

            {/* Mobile View Cards */}
            <div className="md:hidden divide-y divide-muted/10">
              {recurringTemplates.map((template) => (
                <div key={template.id} className="p-4 space-y-3 font-medium">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-tight mb-1">{template.description}</h4>
                      <Badge variant={template.active ? 'default' : 'secondary'} className="text-[8px] h-3.5 uppercase px-1 font-black">
                        {template.active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-foreground">₹{template.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{template.frequency}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-muted/10 pt-3">
                    <div className="text-[10px] text-muted-foreground">
                      Next Due: {new Date(template.nextExecutionDate).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button onClick={() => runRecurringTemplate(template)} variant="ghost" size="sm" className="h-7 text-primary text-[10px] px-2 font-bold uppercase transition-all active:scale-95">
                        Run
                      </Button>
                      <Button onClick={() => handleEditTemplate(template)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button onClick={() => setTemplateToDelete(template.id)} variant="ghost" size="icon" className="h-8 w-8 text-rose-500">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {recurringTemplates.length === 0 && (
                <div className="py-20 text-center text-muted-foreground italic text-sm">
                  No automation rules.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense record and affect cooperative balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteExpense} className="bg-rose-500 hover:bg-rose-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future automatic logging for this expense. Existing records will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTemplate} className="bg-rose-500 hover:bg-rose-600">Stop & Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


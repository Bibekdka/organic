import * as React from 'react';
import { 
  Receipt, 
  Repeat, 
  PieChart, 
  AlertCircle, 
  Loader2,
  Plus
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { SplitType, Member, Frequency } from '@/types';
import { collection, addDoc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void; // eslint-disable-line no-unused-vars
}

const DEFAULT_CATEGORIES = [
  'Electricity',
  'Food',
  'Travel',
  'Utility',
  'Maintenance',
  'Rent',
  'Payroll',
  'Communication',
  'Marketing',
  'Capital',
  'Grocery',
  'Misc',
  'Others'
];

/**
 * AddExpenseDialog Component
 * This component handles the complex logic for logging new organization expenses.
 * It includes:
 * 1. Payer selection and amount input.
 * 2. Dynamic category assignment (with custom option).
 * 3. Recurring expense template creation.
 * 4. Multi-member allocation (Splits) using 4 methods:
 *    - Equal: Divides amount evenly among selected members.
 *    - Percentage: Manual % assignment.
 *    - Equity Shares: Allocates based on member's ownership units.
 *    - Manual: Direct amount entry per member.
 */
export function AddExpenseDialog({ open, onOpenChange }: AddExpenseDialogProps) {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [amount, setAmount] = React.useState<number>(0);
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('Utility');
  const [customCategory, setCustomCategory] = React.useState('');
  const [isCustomCategory, setIsCustomCategory] = React.useState(false);
  const [paidBy, setPaidBy] = React.useState('');
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = React.useState<SplitType>('equal');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [frequency, setFrequency] = React.useState<Frequency>('monthly');
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
  const [manualSplits, setManualSplits] = React.useState<Record<string, number>>({});

  /**
   * Effect: Fetch members from Firestore when the dialog opens.
   * Ensures payer and allocation lists are always up-to-date.
   */
  React.useEffect(() => {
    if (!open) return;
    const q = query(collection(db, 'members'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member));
      setMembers(list);
      
      // Auto-select all members for allocation if none are selected
      if (selectedMemberIds.length === 0) setSelectedMemberIds(list.map(m => m.id));
      // Set a default payer if none selected
      if (!paidBy && list.length > 0) setPaidBy(list[0].id);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));
    return unsub;
  }, [open]);

  /**
   * Memoized Calculation: Expense Allocation (Splits)
   * Recalculates whenever amount, split type, or selected members change.
   */
  const splits = React.useMemo(() => {
    if (amount <= 0 || selectedMemberIds.length === 0) return [];
    const selectedMembers = members.filter(m => selectedMemberIds.includes(m.id));

    if (splitType === 'equal') {
      const perMember = amount / selectedMemberIds.length;
      return selectedMemberIds.map(id => ({ memberId: id, amount: perMember }));
    }

    if (splitType === 'shares') {
      const totalShares = selectedMembers.reduce((sum, m) => sum + (m.shares || 0), 0);
      if (totalShares === 0) return selectedMemberIds.map(id => ({ memberId: id, amount: 0 }));
      return selectedMembers.map(m => ({
        memberId: m.id,
        amount: ((m.shares || 0) / totalShares) * amount,
        percentage: ((m.shares || 0) / totalShares) * 100
      }));
    }

    if (splitType === 'percentage') {
      return selectedMemberIds.map(id => {
        const pct = manualSplits[id] || 0;
        return { memberId: id, amount: (pct / 100) * amount, percentage: pct };
      });
    }

    if (splitType === 'custom') {
      return selectedMemberIds.map(id => ({ memberId: id, amount: manualSplits[id] || 0 }));
    }

    return [];
  }, [amount, splitType, selectedMemberIds, manualSplits, members]);

  const totalSplitAmount = splits.reduce((sum, s) => sum + s.amount, 0);
  const isSplitValid = Math.abs(totalSplitAmount - amount) < 0.1;

  const handleSave = async () => {
    if (!isSplitValid || amount <= 0 || !description) {
      toast.error("Please fill all fields correctly");
      return;
    }
    
    const userId = auth.currentUser?.uid;
    if (!userId) {
      toast.error("User not authenticated");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Use custom category if the user opted for it
      const finalCategory = isCustomCategory ? customCategory : category;
      
      const expenseData = {
        description,
        amount,
        category: finalCategory,
        paidBy,
        date,
        splitType,
        // Map splits into final document format, rounding amounts to 2 decimal places
        splits: splits.map(s => {
          const split: any = {
            memberId: s.memberId,
            amount: parseFloat(s.amount.toFixed(2))
          };
          if (s.percentage !== undefined) {
            split.percentage = parseFloat(s.percentage.toFixed(2));
          }
          return split;
        }),
        createdAt: serverTimestamp(),
        createdBy: userId,
        isRecurring
      };

      // 1. Log the one-time expense instance
      await addDoc(collection(db, 'expenses'), expenseData);

      // 2. If it's recurring, create a template for future automated logs
      if (isRecurring) {
        let daysToAdd = 30;
        if (frequency === 'daily') daysToAdd = 1;
        else if (frequency === 'weekly') daysToAdd = 7;
        else if (frequency === 'monthly') daysToAdd = 30;
        else if (frequency === 'yearly') daysToAdd = 365;

        await addDoc(collection(db, 'recurring_templates'), {
          ...expenseData,
          frequency,
          nextExecutionDate: Date.now() + daysToAdd * 24 * 60 * 60 * 1000,
          active: true
        });
      }

      toast.success("Expense logged successfully");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to log expense. Please try again.");
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Resets all form fields to their initial states.
   */
  const resetForm = () => {
    setAmount(0);
    setDescription('');
    setCategory('Grocery'); // Default to a common category
    setIsRecurring(false);
    setIsCustomCategory(false);
    setCustomCategory('');
    setManualSplits({});
    setPaidBy(members.length > 0 ? members[0].id : '');
    setSplitType('equal');
    setSelectedMemberIds(members.map(m => m.id));
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Log New Expense
          </DialogTitle>
          <DialogDescription>
            Record a cooperative purchase and define allocation rules.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount || ''} 
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex gap-2">
                {!isCustomCategory ? (
                  <>
                    <Select value={category} onValueChange={(v) => {
                      if (v === 'custom') setIsCustomCategory(true);
                      else setCategory(v);
                    }}>
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-primary font-bold">
                          + Add Custom...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <div className="flex-1 flex gap-2">
                    <Input 
                      placeholder="Custom Category name..." 
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setIsCustomCategory(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-primary/20 bg-primary/5">
             <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                   <Repeat className="w-4 h-4 text-primary" />
                   <Label className="text-sm font-bold">Recurring Expense</Label>
                </div>
                <p className="text-[10px] text-muted-foreground">Save as template for future periods.</p>
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
            <Label>Purpose / Description</Label>
            <Input 
              placeholder="What was this for?" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payer (Member)</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select Payer">
                    {members.find(m => m.id === paidBy)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 border rounded-xl p-6 bg-secondary/5 border-border/40">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <Label className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <PieChart className="w-4 h-4 text-primary" />
                  Allocation Method
                </Label>
                <Select value={splitType} onValueChange={(v) => setSplitType(v as SplitType)}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-background">
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

                <div className="grid gap-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                  {members.map((member) => (
                    <div key={member.id} className={cn(
                      "flex items-center justify-between gap-4 p-3 rounded-lg bg-card border transition-all h-14",
                      selectedMemberIds.includes(member.id) ? "border-primary/20 shadow-sm" : "border-transparent opacity-60"
                    )}>
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          id={`member-${member.id}`} 
                          checked={selectedMemberIds.includes(member.id)}
                          onCheckedChange={() => {
                            setSelectedMemberIds(prev => 
                              prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id]
                            );
                          }}
                        />
                        <div className="flex flex-col">
                          <label htmlFor={`member-${member.id}`} className="text-xs font-semibold cursor-pointer">
                            {member.name}
                          </label>
                          <span className="text-[10px] text-muted-foreground font-mono">{member.shares || 0} Units</span>
                        </div>
                      </div>

                      {selectedMemberIds.includes(member.id) && (
                        <div className="flex items-center gap-3">
                          {(splitType === 'percentage' || splitType === 'custom') && (
                            <div className="relative w-20">
                              <Input 
                                className="h-8 pr-6 text-right text-xs bg-background"
                                placeholder={splitType === 'percentage' ? '%' : '₹'}
                                value={manualSplits[member.id] || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setManualSplits(prev => ({ ...prev, [member.id]: val }));
                                }}
                              />
                            </div>
                          )}
                          <div className="text-right min-w-[70px]">
                            <p className="text-xs font-black">₹{splits.find(s => s.memberId === member.id)?.amount.toFixed(2) || '0.00'}</p>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            disabled={!isSplitValid || amount <= 0 || isSubmitting}
            onClick={handleSave} 
            className="shadow-lg shadow-primary/20 px-8"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Confirm & Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

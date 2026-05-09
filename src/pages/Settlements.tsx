import * as React from 'react';
import { 
  ArrowRightLeft, 
  Wallet, 
  ArrowRight,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function SettlementsPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Listen to Members
    const unsubMem = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));

    // Listen to Expenses
    const unsubExp = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    return () => {
      unsubMem();
      unsubExp();
    };
  }, []);

  const calculations = React.useMemo(() => {
    if (members.length === 0) return { balances: {}, settlements: [] };

    // Calculate net balance for each member
    // balance > 0 means the member is owed money
    // balance < 0 means the member owes money
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m.id] = 0);

    expenses.forEach((expense: any) => {
      // 1. Payer gets credit for the full amount
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;

      // 2. Each member in the split owes their portion
      expense.splits?.forEach((split: any) => {
        balances[split.memberId] = (balances[split.memberId] || 0) - split.amount;
      });
    });

    // Simplify settlements
    const debtors = Object.entries(balances)
      .filter(([, bal]) => bal < -0.01)
      .sort((a, b) => a[1] - b[1]); // Most negative first
    
    const creditors = Object.entries(balances)
      .filter(([, bal]) => bal > 0.01)
      .sort((a, b) => b[1] - a[1]); // Most positive first

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
  }, [members, expenses]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Settlements & Net Dues</h2>
        <p className="text-muted-foreground text-sm">Automated debt simplification across all logged expenses.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-md bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
               <Wallet className="w-5 h-5 text-primary" />
               Member Balances
            </CardTitle>
            <CardDescription>Net credit or debt for each member.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {members.map(member => {
                 const balance = calculations.balances[member.id] || 0;
                 return (
                   <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/5 border border-transparent hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                            {member.name[0]}
                         </div>
                         <div>
                            <p className="text-sm font-semibold text-foreground">{member.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{member.role}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className={`text-sm font-black ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {balance >= 0 ? '+' : ''}₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </p>
                         <p className="text-[10px] text-muted-foreground">
                            {balance >= 0 ? 'Owed to them' : 'They owe'}
                         </p>
                      </div>
                   </div>
                 );
               })}
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
               <ArrowRightLeft className="w-5 h-5 text-primary" />
               Suggested Payments
            </CardTitle>
            <CardDescription>Optimized flow to clear all pending dues.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {calculations.settlements.length > 0 ? calculations.settlements.map((s, idx) => (
                 <div key={idx} className="p-4 rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent relative group">
                    <div className="flex items-center justify-between gap-4">
                       <div className="flex-1 space-y-1">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">From</p>
                          <p className="text-sm font-bold text-foreground truncate">{members.find(m => m.id === s.from)?.name}</p>
                       </div>
                       
                       <div className="flex flex-col items-center gap-1 shrink-0">
                          <p className="text-xs font-black text-primary">₹{s.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <div className="flex items-center">
                             <div className="w-2 h-2 rounded-full bg-primary" />
                             <div className="w-12 h-[1px] bg-primary/40" />
                             <ArrowRight className="w-3 h-3 text-primary -ml-1" />
                          </div>
                       </div>

                       <div className="flex-1 space-y-1 text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">To</p>
                          <p className="text-sm font-bold text-foreground truncate">{members.find(m => m.id === s.to)?.name}</p>
                       </div>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-4 h-8 text-[10px] uppercase font-bold tracking-widest hover:bg-emerald-500/10 hover:text-emerald-500 gap-2 text-foreground border border-transparent hover:border-emerald-500/20">
                       <CheckCircle2 className="w-3.5 h-3.5" />
                       Record as Settled
                    </Button>
                 </div>
               )) : (
                 <div className="py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-10" />
                    <p>All group accounts are perfectly balanced!</p>
                 </div>
               )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

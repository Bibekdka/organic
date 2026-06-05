import * as React from 'react';
import { 
  ArrowRightLeft, 
  Wallet, 
  ArrowRight,
  CheckCircle2,
  Loader2,
  PiggyBank
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { calculateSettlements } from '@/lib/utils';

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function SettlementsPage() {
  const { user } = useAuthStore();
  const [members, setMembers] = React.useState<Member[]>([]);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [incomes, setIncomes] = React.useState<any[]>([]);
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSettling, setIsSettling] = React.useState<Record<number, boolean>>({});

  const handleRecordSettlement = async (s: Settlement, index: number) => {
    const debtorMember = s.from === 'bank' ? { name: 'Collective Bank Account', id: 'bank' } : members.find(m => m.id === s.from);
    const creditorMember = s.to === 'bank' ? { name: 'Collective Bank Account', id: 'bank' } : members.find(m => m.id === s.to);
    if (!debtorMember || !creditorMember) return;

    setIsSettling(prev => ({ ...prev, [index]: true }));
    try {
      await addDoc(collection(db, 'expenses'), {
        description: `Debt Clearance: ${debtorMember.name} settled up with ${creditorMember.name}`,
        amount: parseFloat(s.amount.toFixed(2)),
        date: new Date().toISOString().split('T')[0],
        category: 'Settlement',
        paidBy: s.from, // Debtor paid
        splitType: 'custom',
        splits: [
          {
            memberId: s.to, // to Creditor
            amount: parseFloat(s.amount.toFixed(2))
          }
        ],
        createdAt: serverTimestamp(),
        createdByName: user?.displayName || user?.email?.split('@')[0] || 'System',
        createdByEmail: user?.email || '',
        isRecurring: false
      });
      toast.success(`Settlement of ₹${s.amount.toLocaleString()} from ${debtorMember.name} to ${creditorMember.name} successfully logged!`);
    } catch (err: any) {
      toast.error(`Settle-up failed: ${err.message || err}`);
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    } finally {
      setIsSettling(prev => ({ ...prev, [index]: false }));
    }
  };

  React.useEffect(() => {
    // Listen to Members
    const unsubMem = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));

    // Listen to Expenses
    const unsubExp = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    // Listen to Incomes
    const unsubInc = onSnapshot(collection(db, 'incomes'), (snapshot) => {
      setIncomes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'incomes'));

    // Listen to Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      }
    });

    return () => {
      unsubMem();
      unsubExp();
      unsubInc();
      unsubSettings();
    };
  }, []);

  const calculations = React.useMemo(() => {
    const sharePrice = settings?.sharePrice ?? 10;
    return calculateSettlements(members, expenses, incomes, sharePrice);
  }, [members, expenses, incomes, settings]);

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
               {/* 🏦 Collective Bank Account Balance Row */}
               {(() => {
                 const balance = calculations.balances['bank'] || 0;
                 return (
                   <div className="flex items-center justify-between p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/20 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                            <PiggyBank className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-foreground">🏦 Collective Bank Account</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Virtual Clearance Hub</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className={`text-sm font-black ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {balance >= 0 ? '+' : ''}₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </p>
                         <p className="text-[10px] text-muted-foreground">
                            {balance >= 0 ? 'Owed to the Bank' : 'Bank owes members'}
                         </p>
                      </div>
                   </div>
                 );
               })()}

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
                          <p className="text-sm font-bold text-foreground truncate">
                             {s.from === 'bank' ? '🏦 Collective Bank' : (members.find(m => m.id === s.from)?.name || `User (${s.from.substring(0, 5)}...)`)}
                          </p>
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
                          <p className="text-sm font-bold text-foreground truncate">
                             {s.to === 'bank' ? '🏦 Collective Bank' : (members.find(m => m.id === s.to)?.name || `User (${s.to.substring(0, 5)}...)`)}
                          </p>
                       </div>
                    </div>
                    <Button 
                       onClick={() => handleRecordSettlement(s, idx)}
                       disabled={isSettling[idx]}
                       variant="ghost" 
                       size="sm" 
                       className="w-full mt-4 h-8 text-[10px] uppercase font-bold tracking-widest hover:bg-emerald-500/10 hover:text-emerald-500 gap-2 text-foreground border border-transparent hover:border-emerald-500/20 disabled:opacity-50"
                    >
                       {isSettling[idx] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                       ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                       )}
                       {isSettling[idx] ? 'Recording Settlement...' : 'Record as Settled'}
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

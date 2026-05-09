import * as React from 'react';
import { 
  PieChart as PieChartIcon, 
  ArrowRightLeft, 
  History, 
  Users,
  TrendingUp,
  CircleDollarSign,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member, ShareTransaction } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function SharesPage() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [transactions, setTransactions] = React.useState<ShareTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isUpdateOpen, setIsUpdateOpen] = React.useState(false);

  // Form State
  const [selectedMemberId, setSelectedMemberId] = React.useState('');
  const [changeType, setChangeType] = React.useState<'add' | 'remove'>('add');
  const [changeAmount, setChangeAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    const unsubMem = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    const unsubTrans = onSnapshot(collection(db, 'share_transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShareTransaction))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'share_transactions'));

    return () => {
      unsubMem();
      unsubTrans();
    };
  }, []);

  const shareData = React.useMemo(() => {
    return members
      .filter(m => m.shares > 0)
      .map(m => ({
        name: m.name,
        value: m.shares
      }));
  }, [members]);

  const totalShares = members.reduce((sum, m) => sum + (m.shares || 0), 0);

  const handleUpdateShares = async () => {
    if (!selectedMemberId || !changeAmount || parseFloat(changeAmount) <= 0) return;
    
    setIsSubmitting(true);
    const member = members.find(m => m.id === selectedMemberId);
    if (!member) return;

    const amount = parseFloat(changeAmount);
    const finalChange = changeType === 'add' ? amount : -amount;
    const newTotal = (member.shares || 0) + finalChange;

    if (newTotal < 0) {
      toast.error("Member cannot have negative shares");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Update Member
      await updateDoc(doc(db, 'members', selectedMemberId), {
        shares: increment(finalChange)
      });

      // 2. Log Transaction
      await addDoc(collection(db, 'share_transactions'), {
        memberId: selectedMemberId,
        memberName: member.name,
        previousUnits: member.shares || 0,
        newUnits: newTotal,
        change: finalChange,
        reason: reason || (changeType === 'add' ? 'Share Issuance' : 'Share Buyback'),
        createdAt: serverTimestamp()
      });

      toast.success(`Successfully updated shares for ${member.name}`);
      setIsUpdateOpen(false);
      setChangeAmount('');
      setReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${selectedMemberId}`);
    } finally {
      setIsSubmitting(false);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Shares Management</h2>
          <p className="text-muted-foreground text-sm">Equity distribution and capital history.</p>
        </div>
        <Button onClick={() => setIsUpdateOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
          <ArrowRightLeft className="w-4 h-4" /> Issue/Transfer Shares
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Total Issued</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <CircleDollarSign className="w-8 h-8 text-primary" />
                <p className="text-3xl font-black text-foreground">{totalShares.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">Units</span></p>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Active Shareholders</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-emerald-500" />
                <p className="text-3xl font-black text-foreground">{members.filter(m => m.shares > 0).length}</p>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Market Cap (Est)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-amber-500" />
                <p className="text-3xl font-black text-foreground">₹{(totalShares * 100).toLocaleString()}</p>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="border-none shadow-md bg-card/50">
            <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <PieChartIcon className="w-5 h-5 text-primary" />
                  Equity Distribution
               </CardTitle>
               <CardDescription>Breakdown by member percentage.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={shareData}
                           cx="50%"
                           cy="50%"
                           innerRadius={60}
                           outerRadius={100}
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {shareData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                           itemStyle={{ color: '#fff' }}
                        />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="mt-4 grid grid-cols-2 gap-4">
                  {members.filter(m => m.shares > 0).map((m, i) => (
                     <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/10">
                        <div className="flex items-center gap-2 truncate">
                           <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                           <span className="truncate text-foreground font-medium">{m.name}</span>
                        </div>
                        <span className="font-bold text-foreground">{((m.shares / totalShares) * 100).toFixed(1)}%</span>
                     </div>
                  ))}
               </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-md bg-card/50">
            <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <History className="w-5 h-5 text-primary" />
                  Audit Log
               </CardTitle>
               <CardDescription>Recent changes in share capital.</CardDescription>
            </CardHeader>
            <CardContent>
               <ScrollArea className="h-[400px] w-full pr-4">
                  <div className="space-y-4">
                     {transactions.map((t) => (
                        <div key={t.id} className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-2">
                           <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-foreground">{(t as any).memberName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                 {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'Just now'}
                              </p>
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <span className={t.change > 0 ? "text-emerald-500" : "text-rose-500"}>
                                    {t.change > 0 ? '+' : ''}{t.change}
                                 </span>
                                 <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                                 <span className="text-foreground font-bold">{t.newUnits} total</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{t.reason}</p>
                           </div>
                        </div>
                     ))}
                     {transactions.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                           <History className="w-12 h-12 mx-auto mb-2 opacity-10" />
                           <p>No transaction history found.</p>
                        </div>
                     )}
                  </div>
               </ScrollArea>
            </CardContent>
         </Card>
      </div>

      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
         <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
               <DialogTitle>Update Equity Shares</DialogTitle>
               <DialogDescription>Adjust share allocation for a specific member.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Select Member</label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                     <SelectTrigger className="text-foreground">
                        <SelectValue placeholder="Select a member..." />
                     </SelectTrigger>
                     <SelectContent>
                        {members.map(m => (
                           <SelectItem key={m.id} value={m.id}>{m.name} ({m.shares} units)</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                     <label className="text-sm font-medium text-foreground">Type</label>
                     <Select value={changeType} onValueChange={(v: any) => setChangeType(v)}>
                        <SelectTrigger className="text-foreground">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="add">Add Units</SelectItem>
                           <SelectItem value="remove">Remove Units</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="grid gap-2">
                     <label className="text-sm font-medium text-foreground">Amount</label>
                     <Input 
                        type="number" 
                        placeholder="0" 
                        value={changeAmount} 
                        onChange={(e) => setChangeAmount(e.target.value)}
                        className="text-foreground"
                     />
                  </div>
               </div>
               <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Reason/Note</label>
                  <Input 
                    placeholder="e.g. Capital injection, buyback..." 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)}
                    className="text-foreground"
                  />
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsUpdateOpen(false)} className="text-foreground">Cancel</Button>
               <Button disabled={isSubmitting} onClick={handleUpdateShares}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Record Change
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}

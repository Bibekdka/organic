import * as React from 'react';
import { 
  PieChart as PieChartIcon, 
  ArrowRightLeft, 
  History, 
  Users,
  TrendingUp,
  CircleDollarSign,
  Loader2,
  CheckCircle2,
  PiggyBank
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
import { db, auth } from '@/lib/firebase';
import { Member, ShareTransaction, AppSettings, OnboardingRecord } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function SharesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.email === 'bibekdeka97@gmail.com';
  const [members, setMembers] = React.useState<Member[]>([]);
  const [transactions, setTransactions] = React.useState<ShareTransaction[]>([]);
  const [onboarding, setOnboarding] = React.useState<OnboardingRecord[]>([]);
  const [settings, setSettings] = React.useState<AppSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isUpdateOpen, setIsUpdateOpen] = React.useState(false);
  const [isPriceOpen, setIsPriceOpen] = React.useState(false);
  const [isProjectedOpen, setIsProjectedOpen] = React.useState(false);

  // Buy & Sell Shares Form State
  const [isBuySellOpen, setIsBuySellOpen] = React.useState(false);
  const [buySellMemberId, setBuySellMemberId] = React.useState('');
  const [buySellType, setBuySellType] = React.useState<'buy' | 'sell'>('buy');
  const [buySellAmount, setBuySellAmount] = React.useState('');

  // Form State
  const [selectedMemberId, setSelectedMemberId] = React.useState('');
  const [changeType, setChangeType] = React.useState<'add' | 'remove'>('add');
  const [changeAmount, setChangeAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newSharePrice, setNewSharePrice] = React.useState('');

  React.useEffect(() => {
    const unsubMem = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    const unsubTrans = onSnapshot(collection(db, 'share_transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShareTransaction))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'share_transactions'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings({ id: snapshot.id, ...snapshot.data() } as AppSettings);
      } else {
        setSettings({ id: 'global', sharePrice: 10, updatedAt: Date.now() });
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

    const unsubOnboarding = onSnapshot(collection(db, 'onboarding'), (snapshot) => {
      setOnboarding(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingRecord)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'onboarding'));

    return () => {
      unsubMem();
      unsubTrans();
      unsubSettings();
      unsubOnboarding();
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
  const sharePrice = settings?.sharePrice || 10;
  const marketCap = totalShares * sharePrice;
  const totalOnboardingShares = onboarding.reduce((sum, item) => sum + (item.shares || 0), 0);
  const expectedShareSale = totalOnboardingShares * sharePrice;

  const handleUpdatePrice = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    const price = parseFloat(newSharePrice);
    if (isNaN(price) || price <= 0) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        sharePrice: price,
        updatedAt: Date.now(),
        updatedByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Unknown'
      });
      toast.success('Share price updated');
      setIsPriceOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateShares = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
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
        createdAt: serverTimestamp(),
        createdByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Unknown'
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

  const handleBuySellShares = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    if (!buySellMemberId || !buySellAmount || parseFloat(buySellAmount) <= 0) return;
    
    setIsSubmitting(true);
    const member = members.find(m => m.id === buySellMemberId);
    if (!member) {
      setIsSubmitting(false);
      return;
    }

    const amount = parseFloat(buySellAmount);
    const finalChange = buySellType === 'buy' ? amount : -amount;
    const newTotal = (member.shares || 0) + finalChange;

    if (newTotal < 0) {
      toast.error("Member cannot have negative shares");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Update Member
      await updateDoc(doc(db, 'members', buySellMemberId), {
        shares: increment(finalChange)
      });

      // 2. Log Transaction
      await addDoc(collection(db, 'share_transactions'), {
        memberId: buySellMemberId,
        memberName: member.name,
        previousUnits: member.shares || 0,
        newUnits: newTotal,
        change: finalChange,
        reason: buySellType === 'buy' ? 'Member Share Purchase' : 'Member Share Buyback',
        createdAt: serverTimestamp(),
        createdByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Unknown'
      });

      // 3. Keep Income/Expense ledger in sync for financial reports and profit calculations
      if (buySellType === 'buy') {
        await addDoc(collection(db, 'incomes'), {
          source: `Share Purchase: ${member.name}`,
          amount: amount * sharePrice,
          category: 'Sales',
          date: new Date().toISOString().split('T')[0],
          notes: `Member Share Purchase of ${amount} units @ ₹${sharePrice}/unit`,
          createdAt: Date.now(),
          createdBy: auth.currentUser?.uid || 'Unknown',
          createdByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Unknown',
          createdByDevice: 'Web Browser'
        });
      } else {
        await addDoc(collection(db, 'expenses'), {
          description: `Share Buyback: Refund to ${member.name}`,
          amount: amount * sharePrice,
          date: new Date().toISOString().split('T')[0],
          category: 'Settlement',
          paidBy: buySellMemberId,
          splitType: 'custom',
          splits: [
            {
              memberId: buySellMemberId,
              amount: amount * sharePrice
            }
          ],
          createdAt: serverTimestamp(),
          createdByName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'System',
          createdByEmail: auth.currentUser?.email || '',
          isRecurring: false
        });
      }

      toast.success(
        buySellType === 'buy'
          ? `Successfully purchased ${amount} shares for ${member.name}`
          : `Successfully completed buyback of ${amount} shares from ${member.name}`
      );
      setIsBuySellOpen(false);
      setBuySellAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${buySellMemberId}`);
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
          <div className="flex flex-wrap gap-2">
            <Button disabled={!isAdmin} variant="outline" onClick={() => { setNewSharePrice(sharePrice.toString()); setIsPriceOpen(true); }} className="gap-2 text-foreground disabled:opacity-50">
              <CircleDollarSign className="w-4 h-4" /> Set Share Price
            </Button>
            <Button disabled={!isAdmin} variant="outline" onClick={() => { setBuySellMemberId(''); setBuySellType('buy'); setBuySellAmount(''); setIsBuySellOpen(true); }} className="gap-2 text-foreground disabled:opacity-50">
              <ArrowRightLeft className="w-4 h-4" /> Buy / Sell Shares
            </Button>
            <Button disabled={!isAdmin} onClick={() => setIsUpdateOpen(true)} className="gap-2 shadow-lg shadow-primary/20 disabled:opacity-50">
              <ArrowRightLeft className="w-4 h-4" /> Issue/Transfer Shares
            </Button>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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

        <Card 
          onClick={() => setIsProjectedOpen(true)}
          className="border-none shadow-md bg-card/50 text-foreground cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:bg-card/75 active:scale-95"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Expected Share Sale</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <PiggyBank className="w-8 h-8 text-indigo-500" />
                <div>
                   <p className="text-2xl font-black text-foreground">₹{expectedShareSale.toLocaleString()}</p>
                   <p className="text-[10px] text-muted-foreground font-mono font-medium">{totalOnboardingShares} Shares in Queue</p>
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card/50 text-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Share Price</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <CircleDollarSign className="w-8 h-8 text-primary" />
                <p className="text-3xl font-black">₹{sharePrice.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ Unit</span></p>
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-card/50 text-foreground text-center sm:text-left">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Market Cap (Est)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-amber-500" />
                <p className="text-3xl font-black">₹{marketCap.toLocaleString()}</p>
             </div>
          </CardContent>
        </Card>
      </div>

        <Card className="border-none shadow-md bg-card/50 text-foreground">
          <CardHeader>
            <CardTitle className="text-lg">Shareholder Registry</CardTitle>
            <CardDescription>Current share price: ₹{sharePrice} / share</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {/* Desktop View Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Ownership</TableHead>
                    <TableHead className="text-right">Value (₹)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.filter(m => m.shares > 0).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold">{m.name}</TableCell>
                      <TableCell className="text-right font-mono">{m.shares}</TableCell>
                      <TableCell className="text-right">
                        {((m.shares / totalShares) * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600">
                        ₹{(m.shares * sharePrice).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          disabled={!isAdmin}
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setBuySellMemberId(m.id);
                            setBuySellType('buy');
                            setBuySellAmount('');
                            setIsBuySellOpen(true);
                          }}
                          className={cn("h-7 px-3 text-[10px] text-foreground font-semibold disabled:opacity-50")}
                        >
                          Buy / Sell
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View Cards */}
            <div className="md:hidden divide-y divide-border/20">
              {members.filter(m => m.shares > 0).map(m => (
                <div key={m.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{m.shares} Units • {((m.shares / totalShares) * 100).toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">₹{(m.shares * sharePrice).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Equity Value</p>
                    </div>
                  </div>
                  <div className="flex justify-end pr-1">
                    <Button 
                      disabled={!isAdmin}
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setBuySellMemberId(m.id);
                        setBuySellType('buy');
                        setBuySellAmount('');
                        setIsBuySellOpen(true);
                      }}
                      className={cn("h-7 px-3 text-[10px] text-foreground font-semibold disabled:opacity-50")}
                    >
                      Buy / Sell Shares
                    </Button>
                  </div>
                </div>
              ))}
              {members.filter(m => m.shares > 0).length === 0 && (
                <div className="py-12 text-center text-muted-foreground italic text-xs">
                  No active shareholders.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                              <div className="flex flex-col items-end">
                                 <p className="text-[10px] text-muted-foreground">
                                    {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                 </p>
                                 {(t as any).createdByName && (
                                    <p className="text-[8px] text-primary font-black uppercase italic leading-none mt-0.5">By {(t as any).createdByName}</p>
                                 )}
                              </div>
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

      <Dialog open={isPriceOpen} onOpenChange={setIsPriceOpen}>
         <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
               <DialogTitle>Update Share Price</DialogTitle>
               <DialogDescription>Set the global market price for a single unit of share.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
               <label className="text-sm font-medium text-foreground">Price per Share (₹)</label>
               <Input 
                  type="number" 
                  placeholder="100" 
                  value={newSharePrice} 
                  onChange={(e) => setNewSharePrice(e.target.value)}
                  className="mt-2 text-foreground font-black text-lg"
               />
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsPriceOpen(false)} className="text-foreground">Cancel</Button>
               <Button disabled={isSubmitting} onClick={handleUpdatePrice}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Update Market Price
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isBuySellOpen} onOpenChange={setIsBuySellOpen}>
         <DialogContent className="sm:max-w-[425px] text-foreground">
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                  Buy / Sell Shares
               </DialogTitle>
               <DialogDescription>
                  Existing customers or members can purchase additional shares or request corporate share buybacks.
               </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid gap-2">
                  <label className="text-sm font-medium">Select Member</label>
                  <Select value={buySellMemberId} onValueChange={setBuySellMemberId}>
                     <SelectTrigger className="text-foreground">
                        <SelectValue placeholder="Choose an existing member..." />
                     </SelectTrigger>
                     <SelectContent>
                        {members.map(m => (
                           <SelectItem key={m.id} value={m.id}>
                              {m.name} ({m.shares || 0} shares)
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               {(() => {
                  const selectedMember = members.find(m => m.id === buySellMemberId);
                  if (!selectedMember) return null;
                  return (
                     <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-xs space-y-1">
                        <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Current Holdings</p>
                        <div className="flex justify-between font-medium">
                           <span>Shares Owned:</span>
                           <span className="font-bold">{selectedMember.shares || 0} Units</span>
                        </div>
                        <div className="flex justify-between font-medium">
                           <span>Equity Value:</span>
                           <span className="font-bold text-emerald-500">₹{((selectedMember.shares || 0) * sharePrice).toLocaleString()}</span>
                        </div>
                     </div>
                  );
               })()}

               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                     <label className="text-sm font-medium">Transaction Type</label>
                     <Select value={buySellType} onValueChange={(v: 'buy' | 'sell') => setBuySellType(v)}>
                        <SelectTrigger className="text-foreground">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="buy">Buy (Purchase)</SelectItem>
                           <SelectItem value="sell">Sell (Buyback)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="grid gap-2">
                     <label className="text-sm font-medium">Units of Shares</label>
                     <Input 
                        type="number" 
                        placeholder="0" 
                        value={buySellAmount} 
                        onChange={(e) => setBuySellAmount(e.target.value)}
                        className="text-foreground"
                     />
                  </div>
               </div>

               {buySellAmount && parseFloat(buySellAmount) > 0 && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs">
                     <p className="font-bold text-[10px] uppercase text-indigo-500 tracking-wider mb-1">Financial Settlement Details</p>
                     <div className="flex justify-between">
                        <span>Unit Amount:</span>
                        <span>{parseFloat(buySellAmount)} Units @ ₹{sharePrice}/sh</span>
                     </div>
                     <div className="flex justify-between mt-1 pt-1 border-t border-primary/10 text-sm font-black text-foreground">
                        <span>{buySellType === 'buy' ? 'Total Cost (Payable):' : 'Expected Payout (Refund):'}</span>
                        <span className={buySellType === 'buy' ? 'text-indigo-400' : 'text-emerald-400'}>
                           ₹{(parseFloat(buySellAmount) * sharePrice).toLocaleString()}
                        </span>
                     </div>
                  </div>
               )}
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsBuySellOpen(false)} className="text-foreground">Cancel</Button>
               <Button 
                  disabled={isSubmitting || !buySellMemberId || !buySellAmount || parseFloat(buySellAmount) <= 0} 
                  onClick={handleBuySellShares}
               >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Confirm Transaction
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isProjectedOpen} onOpenChange={setIsProjectedOpen}>
         <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 overflow-hidden text-foreground">
            <DialogHeader className="p-6 pb-4 border-b">
               <DialogTitle className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-indigo-500 animate-pulse" />
                  Projected Share Sales
               </DialogTitle>
               <DialogDescription>
                  Upcoming investments from prospective shareholders currently listed in the boarding queue.
               </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 grid grid-cols-2 gap-4">
                  <div>
                     <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Total Projected Shares</p>
                     <p className="text-xl font-black text-indigo-400">
                        {onboarding.reduce((sum, item) => sum + (item.shares || 0), 0)} Units
                     </p>
                  </div>
                  <div>
                     <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">Expected Value</p>
                     <p className="text-xl font-black text-emerald-400">
                        ₹{(onboarding.reduce((sum, item) => sum + (item.shares || 0), 0) * sharePrice).toLocaleString()}
                     </p>
                  </div>
               </div>

               <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Boarding Queue ({onboarding.length})</p>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                     {onboarding.length > 0 ? (
                        onboarding.map((record) => {
                           const recShares = record.shares || 0;
                           return (
                              <div key={record.id} className="p-3 rounded-lg bg-card/40 border border-border/40 flex items-center justify-between hover:bg-card/60 transition-colors">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-xs text-indigo-400">
                                       {record.name[0]}
                                    </div>
                                    <div>
                                       <p className="text-sm font-bold text-foreground">{record.name}</p>
                                       <p className="text-[10px] text-muted-foreground capitalize font-bold tracking-tight">
                                          {record.suggestedRole} • {record.gender || 'unassigned'}
                                       </p>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-sm font-black text-foreground">{recShares} Shares</p>
                                    <p className="text-[10px] text-muted-foreground">₹{(recShares * sharePrice).toLocaleString()}</p>
                                 </div>
                              </div>
                           );
                        })
                     ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/5 rounded-lg border border-dashed">
                           No candidates in onboarding queue.
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

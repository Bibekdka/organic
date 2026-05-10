import * as React from 'react';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Shield, 
  Clock,
  Users,
  Trash2,
  FileText,
  Loader2,
  Check
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { collection, onSnapshot, query, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export function MembersPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [members, setMembers] = React.useState<Member[]>([]);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubMem = onSnapshot(query(collection(db, 'members')), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    const unsubExp = onSnapshot(query(collection(db, 'expenses')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    return () => {
      unsubMem();
      unsubExp();
    };
  }, []);

  const contributions = React.useMemo(() => {
    const stats: Record<string, number> = {};
    members.forEach(m => stats[m.id] = 0);
    expenses.forEach(exp => {
      if (stats[exp.paidBy] !== undefined) {
        stats[exp.paidBy] += exp.amount;
      }
    });
    return stats;
  }, [members, expenses]);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newShares, setNewShares] = React.useState('10');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleAddMember = async () => {
    if (!newName) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'members'), {
        name: newName,
        email: newEmail || '',
        shares: parseFloat(newShares) || 0,
        role: 'member',
        status: 'active',
        joinedAt: Date.now(),
        createdAt: serverTimestamp()
      });
      toast.success(`${newName} added to the organization`);
      setIsAddOpen(false);
      setNewName('');
      setNewEmail('');
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRole = async (member: Member) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    try {
      await updateDoc(doc(db, 'members', member.id), { role: newRole });
      toast.success(`Updated ${member.name} to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${member.id}`);
    }
  };

  const toggleStatus = async (member: Member) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'members', member.id), { status: newStatus });
      toast.success(`${member.name} is now ${newStatus === 'active' ? 'Online' : 'Offline'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${member.id}`);
    }
  };

  const deleteMember = async (id: string) => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'members', id));
      toast.success('Member removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const totalShares = React.useMemo(() => members.reduce((sum, m) => sum + (m.shares || 0), 0), [members]);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [memberTransactions, setMemberTransactions] = React.useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = React.useState(false);

  const viewProfile = (member: Member) => {
    setSelectedMember(member);
    setIsProfileOpen(true);
    setLoadingProfile(true);
    
    const q = query(collection(db, 'share_transactions')); // In a real app, query by memberId
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMemberTransactions(all.filter((t: any) => t.memberId === member.id)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoadingProfile(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'share_transactions'));

    return unsub;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Cooperative Members</h2>
          <p className="text-muted-foreground text-sm">Manage roles, contributions and profiles of members.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
          <UserPlus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="md:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-10 h-11 bg-card border-none shadow-sm focus-visible:ring-primary text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
         <Button variant="outline" className="h-11 bg-card border-none shadow-sm gap-2 text-foreground">
            Sort by: Recently Joined
         </Button>
      </div>

      <div className="bg-card rounded-xl shadow-md border-none overflow-hidden relative min-h-[400px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm z-10">
             <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : null}
        
        <ScrollArea className="w-full">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead className="w-[280px]">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Equity (Units / %)</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member, index) => (
                <TableRow key={member.id} className="hover:bg-muted/50 border-b border-muted/20 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-foreground">
                      <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm truncate">{member.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{member.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-foreground">
                      {member.role === 'admin' ? (
                        <Shield className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium capitalize">{member.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      onClick={() => toggleStatus(member)}
                      variant={member.status === 'active' ? 'default' : 'secondary'} 
                      className={cn(
                        "rounded-full px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider bg-transparent border cursor-pointer hover:bg-muted/30 transition-all active:scale-95",
                        member.status === 'active' ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"
                      )}
                    >
                      {member.status === 'active' ? 'Active' : 'Offline'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold">{member.shares || 0} Units</span>
                      <span className="text-[10px] text-muted-foreground">
                        {totalShares > 0 ? ((member.shares / totalShares) * 100).toFixed(1) : 0}% Ownership
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-sm text-foreground">₹{contributions[member.id]?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                       <Clock className="w-3 h-3" />
                       {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-48 p-1">
                        <DropdownMenuItem onClick={() => viewProfile(member)} className="gap-2 text-xs py-2 text-foreground">
                           <FileText className="w-3.5 h-3.5" /> View Member Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleRole(member)} className="gap-2 text-xs py-2 text-foreground">
                          <Shield className="w-3.5 h-3.5" /> Toggle Admin Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => deleteMember(member.id)}
                          className="gap-2 text-xs py-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        {!loading && filteredMembers.length === 0 && (
          <div className="py-20 text-center space-y-3">
             <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <Search className="w-8 h-8" />
             </div>
             <div>
                <p className="font-bold text-lg text-foreground">No members found</p>
                <p className="text-sm text-muted-foreground">Adjust your filters or invite new members.</p>
             </div>
          </div>
        )}
      </div>

      {/* Member Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
         <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-0">
               <DialogTitle>Member Profile</DialogTitle>
               <DialogDescription>Detailed equity standing and contribution history.</DialogDescription>
            </DialogHeader>
            
            {selectedMember && (
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/10 border border-border/40">
                     <Avatar className="w-16 h-16 border-2 border-background shadow-md">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMember.name}`} />
                        <AvatarFallback>{selectedMember.name[0]}</AvatarFallback>
                     </Avatar>
                     <div className="flex-1 min-w-0">
                        <h4 className="text-xl font-black text-foreground truncate">{selectedMember.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{selectedMember.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                           <Badge variant="outline" className="text-[9px] uppercase font-bold text-primary border-primary/20">
                              {selectedMember.role}
                           </Badge>
                           <Badge variant="outline" className={cn(
                              "text-[9px] uppercase font-bold border-none px-2",
                              selectedMember.status === 'active' ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                           )}>
                              {selectedMember.status === 'active' ? 'Active Member' : 'Offline'}
                           </Badge>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Equity</p>
                        <p className="text-2xl font-black text-foreground">{selectedMember.shares} <span className="text-xs font-normal">Units</span></p>
                        <p className="text-[10px] text-primary/60 font-medium">
                           {totalShares > 0 ? ((selectedMember.shares / totalShares) * 100).toFixed(2) : 0}% Stake
                        </p>
                     </div>
                     <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Contributions</p>
                        <p className="text-2xl font-black text-foreground">₹{contributions[selectedMember.id]?.toLocaleString() || 0}</p>
                        <p className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">Investment in organization</p>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <h5 className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Clock className="w-4 h-4 text-primary" />
                        Share History
                     </h5>
                     <div className="rounded-xl border border-border/40 overflow-hidden">
                        <Table>
                           <TableHeader className="bg-muted/30">
                              <TableRow>
                                 <TableHead className="text-[10px] uppercase font-bold py-2">Date</TableHead>
                                 <TableHead className="text-[10px] uppercase font-bold py-2">Change</TableHead>
                                 <TableHead className="text-[10px] uppercase font-bold py-2">New Balance</TableHead>
                                 <TableHead className="text-[10px] uppercase font-bold py-2">Reason</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {loadingProfile ? (
                                 <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                       <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                 </TableRow>
                              ) : memberTransactions.length > 0 ? memberTransactions.map((t) => (
                                 <TableRow key={t.id} className="text-[11px]">
                                    <TableCell className="text-muted-foreground">
                                       {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                    </TableCell>
                                    <TableCell className={t.change > 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                                       {t.change > 0 ? '+' : ''}{t.change}
                                    </TableCell>
                                    <TableCell className="font-bold text-foreground">{t.newUnits}</TableCell>
                                    <TableCell className="text-muted-foreground italic truncate max-w-[120px]">
                                       {t.reason}
                                    </TableCell>
                                 </TableRow>
                              )) : (
                                 <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                       No share transactions recorded.
                                    </TableCell>
                                 </TableRow>
                              )}
                           </TableBody>
                        </Table>
                     </div>
                  </div>
               </div>
            )}

            <DialogFooter className="p-6 pt-2 bg-muted/5 border-t">
               <Button onClick={() => setIsProfileOpen(false)} className="w-full text-foreground" variant="outline">Close Profile</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>
              Enter the details to invite a new member to the organization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input placeholder="John Doe" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-foreground" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Email Address (Optional)</label>
              <Input placeholder="john@example.com" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="text-foreground" />
            </div>
            <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Equity Shares (Units)</label>
                <Input placeholder="10" type="number" value={newShares} onChange={(e) => setNewShares(e.target.value)} className="text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="text-foreground">Cancel</Button>
            <Button disabled={isSubmitting} onClick={handleAddMember}>
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
               Invite Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

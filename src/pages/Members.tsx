import * as React from 'react';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Shield, 
  Clock,
  Users,
  Trash2,
  Edit,
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
    if (!newName || !newEmail) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'members'), {
        name: newName,
        email: newEmail,
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

  const deleteMember = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'members', id));
      toast.success('Member removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <TableHead className="w-[300px]">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Equity Base</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id} className="hover:bg-muted/50 border-b border-muted/20 transition-colors">
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
                      variant={member.status === 'active' ? 'default' : 'secondary'} 
                      className={cn(
                        "rounded-full px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider bg-transparent border",
                        member.status === 'active' ? "border-emerald-500/30 text-emerald-500" : "border-muted-foreground/30 text-muted-foreground"
                      )}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{(member as any).shares || 0} Units</TableCell>
                  <TableCell className="font-bold text-sm text-foreground">₹{contributions[member.id]?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                       <Clock className="w-3 h-3" />
                       {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-1">
                        <DropdownMenuItem onClick={() => toggleRole(member)} className="gap-2 text-xs py-2 text-foreground">
                          <Edit className="w-3.5 h-3.5" /> Toggle Admin Role
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-xs py-2 text-foreground">
                          <FileText className="w-3.5 h-3.5" /> View Ledger
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
              <label className="text-sm font-medium text-foreground">Email Address</label>
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

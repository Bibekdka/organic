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
  Check,
  Pencil,
  Tag,
  Receipt
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, onSnapshot, query, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member, Expense, OnboardingRecord } from '@/types';
import { toast } from 'sonner';
import { cn, getUserAttribution } from '@/lib/utils';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export function MembersPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [members, setMembers] = React.useState<Member[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [onboarding, setOnboarding] = React.useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('active');

  React.useEffect(() => {
    const unsubMem = onSnapshot(query(collection(db, 'members')), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    const unsubExp = onSnapshot(query(collection(db, 'expenses')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const unsubOnboarding = onSnapshot(query(collection(db, 'onboarding')), (snapshot) => {
      setOnboarding(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingRecord)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'onboarding'));

    return () => {
      unsubMem();
      unsubExp();
      unsubOnboarding();
    };
  }, []);

  const contributions = React.useMemo(() => {
    const stats: Record<string, number> = {};
    members.forEach(m => stats[m.id] = 0);
    expenses.forEach(exp => {
      if (stats[exp.paidBy] !== undefined) {
        if (categoryFilter === 'all' || exp.category === categoryFilter) {
          stats[exp.paidBy] += exp.amount;
        }
      }
    });
    return stats;
  }, [members, expenses, categoryFilter]);

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isOnboardingAddOpen, setIsOnboardingAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newShares, setNewShares] = React.useState('10');
  const [newRole, setNewRole] = React.useState<Member['role']>('member');
  const [newNotes, setNewNotes] = React.useState('');
  const [newAvatar, setNewAvatar] = React.useState(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substring(7)}`);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleAddMember = async () => {
    if (!newName) return;
    setIsSubmitting(true);
    try {
      const attr = getUserAttribution();
      await addDoc(collection(db, 'members'), {
        name: newName,
        email: newEmail || '',
        shares: parseFloat(newShares) || 0,
        role: newRole,
        status: 'active',
        avatarUrl: newAvatar,
        joinedAt: Date.now(),
        createdAt: serverTimestamp(),
        createdByName: attr.userName,
        createdByDevice: attr.device,
        createdBy: attr.userId
      });
      toast.success(`${newName} added to the organization`);
      setIsAddOpen(false);
      resetAddForm();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOnboarding = async () => {
    if (!newName) return;
    setIsSubmitting(true);
    try {
      const attr = getUserAttribution();
      await addDoc(collection(db, 'onboarding'), {
        name: newName,
        email: newEmail || '',
        suggestedRole: newRole,
        notes: newNotes || '',
        createdAt: serverTimestamp(),
        createdByName: attr.userName,
        createdByDevice: attr.device,
        createdBy: attr.userId
      });
      toast.success(`${newName} added to boarding queue`);
      setIsOnboardingAddOpen(false);
      resetAddForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const joinTeam = async (record: OnboardingRecord) => {
    setIsSubmitting(true);
    try {
      const attr = getUserAttribution();
      // 1. Add to members
      await addDoc(collection(db, 'members'), {
        name: record.name,
        email: record.email || '',
        shares: 0,
        role: record.suggestedRole || 'member',
        status: 'active',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.name}`,
        joinedAt: Date.now(),
        createdAt: serverTimestamp(),
        createdByName: attr.userName,
        createdByDevice: attr.device
      });

      // 2. Remove from onboarding
      await deleteDoc(doc(db, 'onboarding', record.id));
      
      toast.success(`${record.name} is now a full member!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'joining team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOnboarding = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'onboarding', id));
      toast.success('Removed from queue');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `onboarding/${id}`);
    }
  };

  const handleEditMember = async () => {
    if (!editingMember || !newName) return;
    setIsSubmitting(true);
    const attr = getUserAttribution();
    try {
      await updateDoc(doc(db, 'members', editingMember.id), {
        name: newName,
        email: newEmail,
        role: newRole,
        updatedByName: attr.userName,
        updatedByDevice: attr.device,
        updatedAt: serverTimestamp()
      });
      toast.success('Member updated successfully');
      setIsEditOpen(false);
      setEditingMember(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${editingMember.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (member: Member) => {
    setEditingMember(member);
    setNewName(member.name);
    setNewEmail(member.email || '');
    setNewRole(member.role);
    setIsEditOpen(true);
  };

  const resetAddForm = () => {
    setNewName('');
    setNewEmail('');
    setNewShares('10');
    setNewRole('member');
    setNewNotes('');
    setNewAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substring(7)}`);
  };

  const updateMemberRole = async (member: Member, role: Member['role']) => {
    const attr = getUserAttribution();
    try {
      await updateDoc(doc(db, 'members', member.id), { 
        role,
        updatedByName: attr.userName,
        updatedByDevice: attr.device,
        updatedAt: serverTimestamp()
      });
      toast.success(`Updated ${member.name}'s role to ${role}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${member.id}`);
    }
  };

  const toggleStatus = async (member: Member) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    const attr = getUserAttribution();
    try {
      await updateDoc(doc(db, 'members', member.id), { 
        status: newStatus,
        updatedByName: attr.userName,
        updatedByDevice: attr.device,
        updatedAt: serverTimestamp()
      });
      toast.success(`${member.name} is now ${newStatus === 'active' ? 'Online' : 'Offline'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${member.id}`);
    }
  };

  const deleteMember = async (id: string) => {
    console.log('Attempting to delete member with ID:', id);
    try {
      await deleteDoc(doc(db, 'members', id));
      toast.success('Member removed');
    } catch (error) {
      console.error('Error deleting member:', error);
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

  React.useEffect(() => {
    if (!isProfileOpen || !selectedMember) {
      setMemberTransactions([]);
      return;
    }

    setLoadingProfile(true);
    const q = query(collection(db, 'share_transactions'));
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setMemberTransactions(all.filter((t: any) => t.memberId === selectedMember.id)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoadingProfile(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'share_transactions'));

    return () => unsub();
  }, [isProfileOpen, selectedMember]);

  const viewProfile = (member: Member) => {
    setSelectedMember(member);
    setIsProfileOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Organization Members</h2>
          <p className="text-muted-foreground text-sm">Manage roles, contributions and profiles of members.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOnboardingAddOpen(true)} className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
            <UserPlus className="w-4 h-4" /> Queue for Onboarding
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
            <Check className="w-4 h-4" /> Direct Add
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-4 h-12 w-full sm:w-auto">
          <TabsTrigger value="active" className="h-10 px-6 font-bold gap-2 data-[state=active]:bg-primary/5">
            <Users className="w-4 h-4" /> 
            <span>Active Members</span>
            <Badge variant="secondary" className="h-5 px-1.5 min-w-[20px] justify-center font-bold text-[10px] rounded-full border-none bg-primary/10 text-primary shrink-0">
              {members.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="h-10 px-6 font-bold gap-2 data-[state=active]:bg-primary/5">
            <UserPlus className="w-4 h-4" /> 
            <span>Onboarding Queue</span>
            <Badge variant="secondary" className="h-5 px-1.5 min-w-[20px] justify-center font-bold text-[10px] rounded-full border-none bg-primary/10 text-primary shrink-0">
              {onboarding.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6 m-0 animate-in fade-in-50 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or email..." 
                  className="pl-10 h-11 bg-card border-none shadow-sm focus-visible:ring-primary text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-11 bg-card border-none shadow-sm text-foreground">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Expense Category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Contributions</SelectItem>
                   <SelectItem value="Electricity">Electricity Only</SelectItem>
                   <SelectItem value="Food">Food Only</SelectItem>
                   <SelectItem value="Travel">Travel Only</SelectItem>
                   <SelectItem value="Utility">Utility Only</SelectItem>
                   <SelectItem value="Maintenance">Maintenance</SelectItem>
                   <SelectItem value="Rent">Rent</SelectItem>
                   <SelectItem value="Payroll">Payroll</SelectItem>
                   <SelectItem value="Grocery">Grocery</SelectItem>
                   <SelectItem value="Misc">Miscellaneous</SelectItem>
                </SelectContent>
             </Select>
             <Button variant="outline" className="h-11 bg-card border-none shadow-sm gap-2 text-foreground">
                Sort by: Recently Joined
             </Button>
          </div>

          <div className="bg-card rounded-xl shadow-md border-none overflow-hidden relative min-h-[400px]">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm z-10">
                 <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            
            {/* Desktop View Table */}
            <div className="hidden md:block">
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
                            <AvatarImage src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} />
                            <AvatarFallback>{member.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm truncate">{member.name}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-bold bg-secondary/20 text-muted-foreground border-none capitalize">
                                {member.role}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground truncate">{member.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-foreground">
                          {member.role === 'admin' ? (
                            <Shield className="w-3.5 h-3.5 text-primary" />
                          ) : member.role === 'president' ? (
                            <Shield className="w-3.5 h-3.5 text-orange-500" />
                          ) : member.role === 'secretary' ? (
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                          ) : member.role === 'promoter' ? (
                            <Shield className="w-3.5 h-3.5 text-emerald-500" />
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
                          <DropdownMenuContent align="end" className="w-56 p-1 text-foreground">
                            <DropdownMenuItem onSelect={() => viewProfile(member)} className="gap-2 text-xs py-2">
                               <FileText className="w-3.5 h-3.5" /> View Member Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEditDialog(member)} className="gap-2 text-xs py-2">
                               <Pencil className="w-3.5 h-3.5" /> Edit Details
                            </DropdownMenuItem>
                            
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-2 text-xs py-2">
                                <Tag className="w-3.5 h-3.5" /> Set Role
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-48 text-foreground">
                                  <DropdownMenuRadioGroup value={member.role} onValueChange={(r) => updateMemberRole(member, r as any)}>
                                  <DropdownMenuRadioItem value="president" className="text-xs font-bold">President</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="secretary" className="text-xs font-bold">Secretary</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="promoter" className="text-xs font-bold">Promoter / Founder</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="admin" className="text-xs font-bold">Administrator</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="member" className="text-xs font-bold">General Member</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onSelect={() => deleteMember(member.id)}
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
            </div>

            {/* Mobile View Cards */}
            <div className="md:hidden divide-y divide-muted/20">
              {filteredMembers.map((member) => (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 border border-muted/20">
                        <AvatarImage src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-none mb-1">{member.name}</h4>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-[8px] h-3.5 w-fit px-1 font-bold bg-secondary/20 text-muted-foreground border-none capitalize">
                            {member.role}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px] leading-none">{member.email}</p>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-56 p-1 text-foreground">
                        <DropdownMenuItem onSelect={() => viewProfile(member)} className="text-xs py-2 gap-2">
                           <FileText className="w-3.5 h-3.5" /> Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openEditDialog(member)} className="text-xs py-2 gap-2">
                           <Pencil className="w-3.5 h-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onSelect={() => deleteMember(member.id)}
                          className="text-xs py-2 gap-2 text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-secondary/20 space-y-1">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Role</p>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-foreground capitalize">{member.role}</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary/20 space-y-1">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Equity</p>
                      <p className="text-[10px] font-bold text-foreground">{member.shares} Units</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary/20 space-y-1 text-primary cursor-pointer hover:bg-primary/5 active:scale-95 transition-all" onClick={() => toggleStatus(member)}>
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Status</p>
                      <p className={cn(
                        "text-[10px] font-black uppercase",
                        member.status === 'active' ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {member.status}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary/20 space-y-1">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Invested ({categoryFilter === 'all' ? 'Total' : categoryFilter})</p>
                      <p className="text-[10px] font-bold text-foreground">₹{contributions[member.id]?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
        </TabsContent>

        <TabsContent value="onboarding" className="m-0 animate-in slide-in-from-right-1 duration-500">
          <div className="bg-card rounded-xl border border-dashed border-primary/20 p-8 min-h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {onboarding.length > 0 ? onboarding.map((record) => (
                <Card key={record.id} className="group relative bg-muted/20 border-none shadow-sm hover:shadow-md transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                            {record.name[0]}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-bold text-foreground truncate">{record.name}</h4>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none">{record.suggestedRole}</p>
                         </div>
                      </div>
                      <Button onClick={() => deleteOnboarding(record.id)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                       <div className="p-3 rounded-lg bg-card/60 border border-border/40">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 italic">Internal Notes</p>
                          <p className="text-xs text-foreground leading-relaxed italic">
                             {record.notes || "No candidate notes provided."}
                          </p>
                       </div>
                       
                       <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/20">
                          <div className="flex flex-col">
                             <p className="text-[9px] text-muted-foreground">Added by {record.createdByName || 'System'}</p>
                             <p className="text-[10px] font-bold text-foreground">
                                {record.createdAt?.toDate ? record.createdAt.toDate().toLocaleDateString() : 'Pending'}
                             </p>
                          </div>
                          <Button 
                            onClick={() => joinTeam(record)} 
                            disabled={isSubmitting}
                            size="sm" 
                            className="bg-primary text-[10px] h-8 px-4 font-black uppercase tracking-tighter"
                          >
                             {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                             Join Team
                          </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 opacity-40">
                  <Users className="w-16 h-16 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-black uppercase text-foreground">Boarding Queue Empty</p>
                    <p className="text-sm italic">Add candidates to the queue to track them before they join.</p>
                  </div>
                  <Button variant="outline" onClick={() => setIsOnboardingAddOpen(true)} className="mt-2 text-foreground">Add First Candidate</Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Member Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
         <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-0">
               <DialogTitle>Member Profile</DialogTitle>
               <DialogDescription>Detailed equity standing and contribution history.</DialogDescription>
            </DialogHeader>
            
            {selectedMember && (
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/10 border border-border/40">
                     <Avatar className="w-16 h-16 border-2 border-background shadow-md">
                        <AvatarImage src={selectedMember.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMember.name}`} />
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

                  <Tabs defaultValue="equity" className="w-full">
                    <TabsList className="grid grid-cols-2 w-full mb-6 py-1 bg-muted/50">
                        <TabsTrigger value="equity" className="text-xs font-bold gap-2">
                           <Tag className="w-3.5 h-3.5" /> Equity & Shares
                        </TabsTrigger>
                        <TabsTrigger value="contributions" className="text-xs font-bold gap-2">
                           <Receipt className="w-3.5 h-3.5" /> Expense History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="equity" className="m-0 space-y-6 animate-in fade-in-50 duration-300">
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
                            <p className="text-2xl font-black text-foreground">₹{expenses.filter(e => e.paidBy === selectedMember.id).reduce((s, e) => s + e.amount, 0).toLocaleString()}</p>
                            <p className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">Lifetime paid by member</p>
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
                    </TabsContent>

                    <TabsContent value="contributions" className="m-0 space-y-6 animate-in fade-in-50 duration-300">
                      <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                        <div className="flex flex-col">
                           <h5 className="text-sm font-bold text-foreground">Expense Contributions</h5>
                           <p className="text-[10px] text-muted-foreground">Breakdown of specific payments.</p>
                        </div>
                        <Select defaultValue="all" onValueChange={setCategoryFilter}>
                          <SelectTrigger className="w-[180px] h-9 text-xs bg-muted/20 border-border/40 text-foreground">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Items</SelectItem>
                              <SelectItem value="Food">Food</SelectItem>
                              <SelectItem value="Travel">Travel</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Utility">Utility</SelectItem>
                              <SelectItem value="Payroll">Payroll</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-xl border border-border/40 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/30">
                            <TableRow>
                              <TableHead className="text-[10px] uppercase font-bold">Expense</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold">Category</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold text-right">Amount</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold text-center">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {expenses
                              .filter(e => e.paidBy === selectedMember.id && (categoryFilter === 'all' || e.category === categoryFilter))
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map(exp => (
                                <TableRow key={exp.id} className="text-[11px] group">
                                  <TableCell className="font-bold text-foreground">{exp.description}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-[8px] h-3.5 leading-none px-1 uppercase font-black tracking-tighter opacity-70">
                                      {exp.category}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-black text-emerald-600">₹{exp.amount.toLocaleString()}</TableCell>
                                  <TableCell className="text-center text-muted-foreground whitespace-nowrap">{exp.date}</TableCell>
                                </TableRow>
                              ))
                            }
                            {expenses.filter(e => e.paidBy === selectedMember.id && (categoryFilter === 'all' || e.category === categoryFilter)).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                   No expenses found for this selection.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      <Card className="bg-secondary/5 border-dashed border-border/60">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Selected Filter Total</p>
                            <p className="text-lg font-black text-foreground">
                              ₹{expenses
                                .filter(e => e.paidBy === selectedMember.id && (categoryFilter === 'all' || e.category === categoryFilter))
                                .reduce((s, e) => s + e.amount, 0)
                                .toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Impact Factor</p>
                             <p className="text-lg font-black text-primary">
                                {(() => {
                                  const memberTotal = expenses.filter(e => e.paidBy === selectedMember.id && (categoryFilter === 'all' || e.category === categoryFilter)).reduce((s, e) => s + e.amount, 0);
                                  const categoryTotal = expenses.filter(e => categoryFilter === 'all' || e.category === categoryFilter).reduce((s, e) => s + e.amount, 0);
                                  return categoryTotal > 0 ? ((memberTotal / categoryTotal) * 100).toFixed(1) : '0';
                                })()}%
                             </p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
               </div>
            )}

            <DialogFooter className="p-6 pt-2 bg-muted/5 border-t">
               <Button onClick={() => setIsProfileOpen(false)} className="w-full text-foreground" variant="outline">Close Profile</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Onboarding Add Dialog */}
      <Dialog open={isOnboardingAddOpen} onOpenChange={setIsOnboardingAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add to Boarding Queue</DialogTitle>
            <DialogDescription>
              Collect names and info for potential team members before they join.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-foreground">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Candidate Name</label>
              <Input placeholder="Candidate Full Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Email (Optional)</label>
              <Input placeholder="candidate@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Potential Role</label>
              <Select value={newRole} onValueChange={(r: any) => setNewRole(r)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="president">President</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="promoter">Promoter</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="member">Staff/Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Onboarding Notes</label>
              <Input placeholder="e.g. Needs specialized training, starting next month..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsOnboardingAddOpen(false); resetAddForm(); }}>Cancel</Button>
            <Button disabled={isSubmitting} onClick={handleAddOnboarding}>
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
               Queue Candidate
            </Button>
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
            <div className="flex flex-col items-center gap-4 mb-2">
               <Avatar className="w-20 h-20 border-4 border-primary/20 shadow-xl">
                  <AvatarImage src={newAvatar} />
                  <AvatarFallback className="text-2xl">{newName[0] || '?'}</AvatarFallback>
               </Avatar>
               <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setNewAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substring(7)}`)}
                className="text-xs h-8 text-foreground"
               >
                 Generate New Avatar
               </Button>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input placeholder="John Doe" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-foreground" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Email Address (Optional)</label>
              <Input placeholder="john@example.com" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="text-foreground" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Official Role</label>
              <Select value={newRole} onValueChange={(r: any) => setNewRole(r)}>
                <SelectTrigger className="text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="president">President</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="promoter">Promoter</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="member">Staff/Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Equity Shares (Units)</label>
                <Input placeholder="10" type="number" value={newShares} onChange={(e) => setNewShares(e.target.value)} className="text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetAddForm(); }} className="text-foreground">Cancel</Button>
            <Button disabled={isSubmitting} onClick={handleAddMember}>
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
               Invite Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member profile and organizational standing.</DialogDescription>
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
              <label className="text-sm font-medium text-foreground">Official Role</label>
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger className="text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="president">President</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="promoter">Promoter</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="member">Staff/Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="text-foreground">Cancel</Button>
            <Button disabled={isSubmitting} onClick={handleEditMember}>
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
               Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

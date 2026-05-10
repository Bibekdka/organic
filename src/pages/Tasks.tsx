import * as React from 'react';
import { 
  ClipboardList, 
  Plus, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MoreVertical,
  User,
  Trash2,
  ChevronRight,
  Filter,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, TaskStatus, TaskPriority, Member } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_COLUMNS: { id: TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'todo', label: 'To Do', icon: Clock, color: 'bg-slate-500' },
  { id: 'in_progress', label: 'In Progress', icon: AlertCircle, color: 'bg-blue-500' },
  { id: 'done', label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-500' },
];

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-100 text-amber-600 border-amber-200',
  high: 'bg-rose-100 text-rose-600 border-rose-200',
};

export function TasksPage() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  
  // New task form state
  const [newTitle, setNewTitle] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [newPriority, setNewPriority] = React.useState<TaskPriority>('medium');
  const [newAssignee, setNewAssignee] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    const tasksQuery = query(collection(db, 'tasks'));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    const membersQuery = query(collection(db, 'members'));
    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    return () => {
      unsubTasks();
      unsubMembers();
    };
  }, []);

  const handleAddTask = async () => {
    if (!newTitle) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTitle,
        description: newDesc,
        status: 'todo',
        priority: newPriority,
        assignedTo: newAssignee || null,
        createdAt: Date.now(),
        societyId: 'default-society'
      });
      toast.success('Task created successfully');
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setNewAssignee('');
      setIsAddOpen(false);
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      toast.success('Task removed');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const getMemberData = (memberId?: string) => {
    return members.find(m => m.id === memberId);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 bg-gradient-to-br from-primary to-primary/80">
              <ClipboardList className="w-6 h-6" />
            </div>
            Tasks & Kanban
          </h1>
          <p className="text-muted-foreground mt-2 font-medium flex items-center gap-2">
            Organize workloads and track cooperative projects.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2 bg-card border-none shadow-sm text-foreground">
             <Filter className="w-4 h-4" /> Filter
           </Button>
           <Button onClick={() => setIsAddOpen(true)} className="gap-2 shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
             <Plus className="w-4 h-4" /> New Task
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
        {STATUS_COLUMNS.map((column) => (
          <div key={column.id} className="flex flex-col h-full bg-secondary/5 rounded-2xl border border-dashed border-border/50 p-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${column.color}`} />
                <h3 className="font-black text-sm uppercase tracking-wider text-muted-foreground">{column.label}</h3>
                <Badge variant="secondary" className="rounded-full bg-secondary text-[10px] px-2 py-0">
                  {tasks.filter(t => t.status === column.id).length}
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-muted">
              <AnimatePresence mode="popLayout">
                {tasks
                  .filter(t => t.status === column.id)
                  .map((task) => {
                    const assignee = getMemberData(task.assignedTo);
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative bg-card rounded-xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <Badge variant="outline" className={`text-[9px] uppercase font-bold py-0 ${PRIORITY_COLORS[task.priority]}`}>
                            {task.priority}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="ghost" size="icon" className="w-7 h-7 -mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            } />
                            <DropdownMenuContent align="end" className="w-48 text-foreground">
                              <DropdownMenuItem className="text-xs" onClick={() => updateTaskStatus(task.id, 'todo')}>Move to To Do</DropdownMenuItem>
                              <DropdownMenuItem className="text-xs" onClick={() => updateTaskStatus(task.id, 'in_progress')}>Move to In Progress</DropdownMenuItem>
                              <DropdownMenuItem className="text-xs" onClick={() => updateTaskStatus(task.id, 'done')}>Move to Completed</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs text-rose-500 focus:text-rose-500" onClick={() => deleteTask(task.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <h4 className="font-bold text-sm text-foreground leading-snug mb-1">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{task.description}</p>
                        )}

                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-1.5">
                            {assignee ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="w-5 h-5 border border-background">
                                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${assignee.name}`} />
                                  <AvatarFallback>{assignee.name[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">{assignee.name}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground/30">
                                <User className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-medium">Unassigned</span>
                              </div>
                            )}
                          </div>
                          
                          {column.id !== 'done' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                const nextStatus = column.id === 'todo' ? 'in_progress' : 'done';
                                updateTaskStatus(task.id, nextStatus);
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
              
              {tasks.filter(t => t.status === column.id).length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                  <column.icon className="w-8 h-8 mb-2" />
                  <p className="text-[10px] font-medium uppercase tracking-widest">No tasks yet</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new entry to the organization workflow.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Task Title</label>
              <Input 
                placeholder="Fix plumbing, Prepare audit..." 
                value={newTitle} 
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Description (Optional)</label>
              <Textarea 
                placeholder="Detailed notes regarding this task..." 
                value={newDesc} 
                onChange={(e) => setNewDesc(e.target.value)}
                className="min-h-[100px] text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Priority</label>
                <Select value={newPriority} onValueChange={(v: TaskPriority) => setNewPriority(v)}>
                  <SelectTrigger className="text-foreground">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Assign To</label>
                <Select value={newAssignee} onValueChange={setNewAssignee}>
                  <SelectTrigger className="text-foreground">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="text-foreground">Cancel</Button>
            <Button 
               onClick={handleAddTask} 
               disabled={!newTitle || isSubmitting}
               className="bg-primary text-primary-foreground font-bold"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

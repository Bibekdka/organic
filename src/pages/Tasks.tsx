import * as React from 'react';
import { 
  ClipboardList, 
  Plus, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MoreVertical,
  User as UserIcon,
  Trash2,
  Filter,
  Loader2,
  GripVertical,
  Pencil
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, TaskStatus, TaskPriority, Member } from '@/types';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { cn, getUserAttribution } from '@/lib/utils';
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
import { useAuthStore } from '@/store/useAuthStore';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STATUS_COLUMNS: { id: TaskStatus; label: string; icon: any; color: string; bgColor: string }[] = [
  { id: 'todo', label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'in_progress', label: 'Processing', icon: AlertCircle, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
];

const STICKY_COLORS = [
  'bg-yellow-100 border-yellow-200 text-yellow-900 shadow-yellow-100',
  'bg-blue-100 border-blue-200 text-blue-900 shadow-blue-100',
  'bg-green-100 border-green-200 text-green-900 shadow-green-100',
  'bg-rose-100 border-rose-200 text-rose-900 shadow-rose-100',
  'bg-purple-100 border-purple-200 text-purple-900 shadow-purple-100',
];

const PRIORITY_COLORS = {
  low: 'border-slate-300 text-slate-500',
  medium: 'border-amber-400 text-amber-600',
  high: 'border-rose-400 text-rose-600',
};

interface StickyNoteProps {
  key?: React.Key;
  task: Task;
  assignee?: Member;
  onDelete: () => void;
  onEdit: () => void;
  // eslint-disable-next-line no-unused-vars
  onUpdateStatus(status: TaskStatus): Promise<void> | void;
}

function StickyNote({ task, assignee, onDelete, onEdit, onUpdateStatus }: StickyNoteProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.email === 'bibekdeka97@gmail.com';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStickyColor = (id: string) => {
    const index = parseInt(id.slice(-1), 36) % STICKY_COLORS.length || 0;
    return STICKY_COLORS[index];
  };

  const rotation = React.useMemo(() => (Math.random() * 2 - 1).toFixed(1), []);

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={isDragging ? 'cursor-grabbing' : 'cursor-default'}
    >
      <motion.div
        layout
        style={{ rotate: isDragging ? 0 : `${rotation}deg` }}
        className={`group relative p-4 mb-4 rounded-sm shadow-sm border border-b-2 transition-all hover:shadow-md hover:scale-[1.02] ${getStickyColor(task.id)}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div 
            {...attributes} 
            {...listeners} 
            className={cn("cursor-grab active:cursor-grabbing p-2.5 -ml-2 -mt-2 rounded-md text-current/30 hover:text-current/60 hover:bg-current/5 transition-colors", !isAdmin && "hidden")}
            title="Drag to move"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Badge variant="outline" className={`text-[8px] uppercase font-black px-1.5 py-0 border ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </Badge>
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }} 
              variant="ghost" 
              size="icon" 
              className={cn("w-7 h-7 text-current/40 hover:text-current/70 hover:bg-current/5", !isAdmin && "hidden")}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" className={cn("w-7 h-7 -mr-2 text-current/40 hover:text-current/70 hover:bg-current/5", !isAdmin && "hidden")}>
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-48 text-foreground">
                <DropdownMenuItem onClick={onEdit} className="text-xs cursor-pointer">
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {STATUS_COLUMNS.map(col => (
                  <DropdownMenuItem key={col.id} onClick={() => onUpdateStatus(col.id)} className="text-xs cursor-pointer">
                    Move to {col.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-xs text-rose-500 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <h4 className="font-bold text-sm leading-tight mb-2 font-mono scrollbar-hide">{task.title}</h4>
        {task.description && (
          <p className="text-[11px] opacity-80 line-clamp-3 mb-4 leading-relaxed font-medium italic underline decoration-current/10 decoration-wavy">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-current/10">
          <div className="flex items-center gap-1.5">
            {assignee ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="w-5 h-5 border-2 border-white shadow-sm">
                  <AvatarImage src={assignee.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${assignee.name}`} />
                  <AvatarFallback>{assignee.name[0]}</AvatarFallback>
                </Avatar>
                <span className="text-[9px] font-black uppercase tracking-tighter opacity-70 truncate max-w-[80px]">{assignee.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 opacity-30">
                <UserIcon className="w-3 h-3" />
                <span className="text-[8px] font-bold uppercase">Open</span>
              </div>
            )}
          </div>
          <div className="text-[8px] font-bold opacity-40 flex flex-col items-end">
            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
            {(task.updatedByName || task.createdByName) && (
              <span className="italic mt-0.5">By {task.updatedByName || task.createdByName}</span>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/5 rounded-tl-full pointer-events-none" />
      </motion.div>
    </div>
  );
}

export function TasksPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.email === 'bibekdeka97@gmail.com';
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [taskToEdit, setTaskToEdit] = React.useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  
  const [newTitle, setNewTitle] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [newPriority, setNewPriority] = React.useState<TaskPriority>('medium');
  const [newAssignee, setNewAssignee] = React.useState('');
  
  const [editTitle, setEditTitle] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<TaskPriority>('medium');
  const [editAssignee, setEditAssignee] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  React.useEffect(() => {
    const unsubTasks = onSnapshot(query(collection(db, 'tasks')), (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    const unsubMembers = onSnapshot(query(collection(db, 'members')), (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'members'));

    return () => {
      unsubTasks();
      unsubMembers();
    };
  }, []);

  const handleAddTask = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    if (!newTitle) return;
    setIsSubmitting(true);
    const attr = getUserAttribution();
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTitle,
        description: newDesc,
        status: 'todo',
        priority: newPriority,
        assignedTo: (newAssignee && newAssignee !== 'unassigned') ? newAssignee : null,
        createdAt: Date.now(),
        createdByName: attr.userName,
        createdByDevice: attr.device,
        createdBy: attr.userId,
        societyId: 'default-society'
      });
      toast.success('Note stuck to the board!');
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setNewAssignee('');
      setIsAddOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (task: Task) => {
    setTaskToEdit(task);
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditPriority(task.priority);
    setEditAssignee(task.assignedTo || 'unassigned');
    setIsEditOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    if (!taskToEdit || !editTitle) return;
    setIsSubmitting(true);
    const attr = getUserAttribution();
    try {
      await updateDoc(doc(db, 'tasks', taskToEdit.id), {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
        assignedTo: editAssignee === 'unassigned' ? null : editAssignee,
        updatedAt: serverTimestamp(),
        updatedByName: attr.userName,
        updatedByDevice: attr.device
      });
      toast.success('Note updated!');
      setIsEditOpen(false);
      setTaskToEdit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskToEdit.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    const attr = getUserAttribution();
    try {
      await updateDoc(doc(db, 'tasks', taskId), { 
        status: newStatus,
        updatedByName: attr.userName,
        updatedByDevice: attr.device,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const deleteTask = async () => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can perform this action");
      return;
    }
    if (!taskToDelete) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskToDelete));
      toast.success('Task removed');
      setTaskToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskToDelete}`);
    }
  };

  const handleDragEnd = async (event: any) => {
    if (!isAdmin) {
      toast.error("Permission Denied: Only bibekdeka97@gmail.com can transition tasks");
      return;
    }
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Check if over a column or a task
    let overStatus: TaskStatus | null = null;
    if (STATUS_COLUMNS.find(col => col.id === over.id)) {
      overStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) overStatus = overTask.status;
    }

    if (overStatus && activeTask.status !== overStatus) {
      await updateTaskStatus(active.id, overStatus);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center text-amber-900 shadow-lg shadow-amber-200">
              <ClipboardList className="w-6 h-6" />
            </div>
            Workflow Board
          </h1>
          <p className="text-muted-foreground mt-2 font-medium flex items-center gap-2 italic">
            "Stick it, move it, done it." - Collaborative task management.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2 bg-card border-none shadow-sm text-foreground">
             <Filter className="w-4 h-4" /> Filter
           </Button>
           <Button disabled={!isAdmin} onClick={() => setIsAddOpen(true)} className={cn("gap-2 shadow-lg shadow-amber-200 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:pointer-events-none")}>
             <Plus className="w-4 h-4" /> Stick Note
           </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-auto lg:h-[calc(100vh-280px)] min-h-[500px]">
          {STATUS_COLUMNS.map((column) => (
            <div key={column.id} className="flex flex-col h-[500px] lg:h-full bg-slate-50/50 rounded-lg border-2 border-dashed border-slate-200 p-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-current opacity-10" />
               
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${column.color.replace('text', 'bg')}`} />
                  <h3 className={`font-black text-xs uppercase tracking-widest ${column.color}`}>{column.label}</h3>
                  <Badge variant="secondary" className="rounded-md bg-white border border-slate-200 text-slate-500 text-[10px] px-2 py-0 font-bold">
                    {tasks.filter(t => t.status === column.id).length}
                  </Badge>
                </div>
              </div>

              <div id={column.id} className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide bg-slate-100/30 rounded-lg p-2 border border-slate-200/50">
                <SortableContext 
                  items={tasks.filter(t => t.status === column.id).map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence mode="popLayout">
                    {tasks
                      .filter(t => t.status === column.id)
                      .map((task) => (
                        <StickyNote 
                          key={task.id} 
                          task={task} 
                          assignee={members.find(m => m.id === task.assignedTo)}
                          onDelete={() => setTaskToDelete(task.id)}
                          onEdit={() => handleOpenEdit(task)}
                          onUpdateStatus={(s) => updateTaskStatus(task.id, s)}
                        />
                      ))}
                  </AnimatePresence>
                </SortableContext>
                
                {tasks.filter(t => t.status === column.id).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                    <column.icon className="w-12 h-12 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Drop notes here</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeId && activeTask ? (
            <div className="scale-105 opacity-90 cursor-grabbing pointer-events-none">
               <StickyNote 
                task={activeTask} 
                assignee={members.find(m => m.id === activeTask.assignedTo)}
                onDelete={() => {}}
                onEdit={() => {}}
                onUpdateStatus={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px] bg-amber-50">
          <DialogHeader>
            <DialogTitle className="text-amber-900 font-black">New Sticky Note</DialogTitle>
            <DialogDescription className="text-amber-700/70 font-medium italic">What's on your mind? Stick it to the board.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-amber-800 tracking-wider">Note Summary</label>
              <Input 
                placeholder="What needs to be done?" 
                value={newTitle} 
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-white border-amber-200 text-amber-900 placeholder:text-amber-300 font-bold focus:ring-amber-400 h-11"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-amber-800 tracking-wider">Extra Details (Optional)</label>
              <Textarea 
                placeholder="Write down some notes..." 
                value={newDesc} 
                onChange={(e) => setNewDesc(e.target.value)}
                className="min-h-[100px] bg-white border-amber-200 text-amber-900 placeholder:text-amber-300 focus:ring-amber-400 resize-none font-medium text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase text-amber-800 tracking-wider">Priority</label>
                <Select value={newPriority} onValueChange={(v: TaskPriority) => setNewPriority(v)}>
                  <SelectTrigger className="bg-white border-amber-200 text-amber-900 font-bold capitalize">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-slate-600">Low</SelectItem>
                    <SelectItem value="medium" className="text-amber-600">Medium</SelectItem>
                    <SelectItem value="high" className="text-rose-600 font-bold">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase text-amber-800 tracking-wider">Task For</label>
                  <Select value={newAssignee} onValueChange={setNewAssignee}>
                    <SelectTrigger className="bg-white border-amber-200 text-amber-900 font-bold">
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Open for anyone</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="text-amber-700 hover:bg-amber-100 font-bold">Nevermind</Button>
            <Button 
               onClick={handleAddTask} 
               disabled={!newTitle || isSubmitting}
               className="bg-amber-400 hover:bg-amber-500 text-amber-950 font-black px-8 border-b-2 border-amber-600 shadow-sm"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Stick It!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[450px] bg-blue-50">
          <DialogHeader>
            <DialogTitle className="text-blue-900 font-black">Edit Sticky Note</DialogTitle>
            <DialogDescription className="text-blue-700/70 font-medium italic">Update the message, priority, or ownership of this task.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-blue-800 tracking-wider">Note Summary</label>
              <Input 
                placeholder="What needs to be done?" 
                value={editTitle} 
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-white border-blue-200 text-blue-900 placeholder:text-blue-300 font-bold focus:ring-blue-400 h-11"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase text-blue-800 tracking-wider">Extra Details (Optional)</label>
              <Textarea 
                placeholder="Write down some notes..." 
                value={editDesc} 
                onChange={(e) => setEditDesc(e.target.value)}
                className="min-h-[100px] bg-white border-blue-200 text-blue-900 placeholder:text-blue-300 focus:ring-blue-400 resize-none font-medium text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase text-blue-800 tracking-wider">Priority</label>
                <Select value={editPriority} onValueChange={(v: TaskPriority) => setEditPriority(v)}>
                  <SelectTrigger className="bg-white border-blue-200 text-blue-900 font-bold capitalize">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-slate-600">Low</SelectItem>
                    <SelectItem value="medium" className="text-amber-600">Medium</SelectItem>
                    <SelectItem value="high" className="text-rose-600 font-bold">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-black uppercase text-blue-800 tracking-wider">Task For</label>
                  <Select value={editAssignee} onValueChange={setEditAssignee}>
                    <SelectTrigger className="bg-white border-blue-200 text-blue-900 font-bold">
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Open for anyone</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="text-blue-700 hover:bg-blue-100 font-bold order-2 sm:order-1">Cancel</Button>
            <Button 
               onClick={handleUpdateTask} 
               disabled={!editTitle || isSubmitting}
               className="bg-blue-500 hover:bg-blue-600 text-white font-black px-8 border-b-2 border-blue-700 shadow-sm order-1 sm:order-2"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tear off this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the task from the board. 
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Wait</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask} className="bg-rose-500 hover:bg-rose-600">Yes, Tear it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

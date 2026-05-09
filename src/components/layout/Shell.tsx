import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  PieChart, 
  Receipt, 
  Wallet, 
  CheckSquare, 
  FileText, 
  Bell, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  collapsed?: boolean;
  key?: React.Key;
}

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
      active 
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}
  >
    <Icon className={cn("w-5 h-5 shrink-0", active ? "text-inherit" : "group-hover:scale-110 duration-200")} />
    {!collapsed && (
      <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all">
        {label}
      </span>
    )}
  </button>
);

export type PageId = 'dashboard' | 'members' | 'shares' | 'expenses' | 'settlements' | 'income' | 'tasks' | 'reports' | 'settings';

interface ShellProps {
  children: React.ReactNode;
  activePage: PageId;
  onPageChange: (page: PageId) => void;
}

export function Shell({ children, activePage, onPageChange }: ShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const user = useAuthStore((state) => state.user);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'shares', label: 'Shares', icon: PieChart },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'settlements', label: 'Settlements', icon: Wallet },
    { id: 'income', label: 'Income', icon: TrendingUp },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Sidebar - Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 260 }}
        className={cn(
          "hidden md:flex flex-col border-r bg-card relative z-20 transition-all duration-300",
          isCollapsed ? "items-center" : ""
        )}
      >
        <div className="h-20 flex items-center px-6 mb-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
             </div>
             {!isCollapsed && (
               <motion.span 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }}
                 className="text-lg font-bold tracking-tight text-primary bg-clip-text leading-tight"
               >
                 Organic-O-Eats <span className="text-foreground">MPCS. Ltd</span>
               </motion.span>
             )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activePage === item.id}
              onClick={() => onPageChange(item.id)}
              collapsed={isCollapsed}
            />
          ))}
        </nav>

        <div className="p-4 border-t space-y-4">
           {user && !isCollapsed && (
             <div className="flex items-center gap-3 px-2 py-3 rounded-xl bg-secondary/50">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
                  {user.displayName?.[0] || user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold truncate leading-none mb-1">{user.displayName || 'User'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
             </div>
           )}
           <Button 
             variant="ghost" 
             className={cn("w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10", isCollapsed && "px-0 justify-center")}
             onClick={handleLogout}
           >
             <LogOut className="w-5 h-5 shrink-0" />
             {!isCollapsed && <span className="font-medium">Logout</span>}
           </Button>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 w-6 h-6 rounded-full border bg-card flex items-center justify-center hover:bg-secondary shadow-sm transition-transform duration-200"
          style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </motion.aside>

      {/* Mobile Menu Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <motion.aside
        initial={{ x: "-100%" }}
        animate={{ x: isMobileOpen ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 left-0 w-72 bg-card border-r z-50 md:hidden flex flex-col"
      >
        <div className="h-20 flex items-center justify-between px-6 border-b">
           <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              <span className="text-lg font-bold tracking-tight">Organic-O-Eats</span>
           </div>
           <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(false)}>
              <X className="w-6 h-6" />
           </Button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activePage === item.id}
              onClick={() => {
                onPageChange(item.id);
                setIsMobileOpen(false);
              }}
            />
          ))}
        </nav>
        <div className="p-4 border-t">
           <Button variant="ghost" className="w-full justify-start gap-3 text-destructive" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
           </Button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Top Header */}
        <header className="h-16 px-4 md:px-8 border-b bg-card/50 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileOpen(true)}>
              <Menu className="w-6 h-6" />
            </Button>
            <h1 className="text-lg md:text-xl font-semibold capitalize tracking-tight">
              {activePage.replace('-', ' ')}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="relative group">
              <Bell className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card" />
            </Button>
            <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />
            <div className="flex items-center gap-3">
               <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium leading-none">{user?.displayName || 'Welcome'}</p>
                  <p className="text-[10px] text-muted-foreground">Admin Pro</p>
               </div>
               <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary/60 border border-primary/20 flex items-center justify-center text-white font-bold shadow-inner">
                  {user?.displayName?.[0] || 'A'}
               </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-muted/20">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="max-w-7xl mx-auto space-y-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

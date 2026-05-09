import * as React from 'react';
import { useAuthStore } from './store/useAuthStore';
import { Shell, PageId } from './components/layout/Shell';
import { Dashboard } from './pages/Dashboard';
import { MembersPage } from './pages/Members';
import { ExpensesPage } from './pages/Expenses';
import { SettlementsPage } from './pages/Settlements';
import { SharesPage } from './pages/Shares';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Button } from './components/ui/button';
import { 
  LogIn, 
  TrendingUp, 
  ShieldCheck,
  CreditCard,
  Loader2,
  Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './lib/firebase';

// Placeholder pages for others
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
      <Package className="w-10 h-10" />
    </div>
    <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
    <p className="text-muted-foreground max-w-sm">
      This module is part of the premium setup and is currently being initialized for your organization.
    </p>
    <Button variant="outline">Learn More</Button>
  </div>
);

function LoginPage() {
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    // Prompt the user to select their account
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      window.console.error("Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        toast.error("Sign-in popup was blocked. Please allow popups for this site in your browser settings.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // No need to show error, just reset state
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.info("Sign-in window closed.");
      } else {
        toast.error("Login failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-neutral-950 text-white overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center rotate-6 shadow-xl shadow-primary/50">
             <TrendingUp className="w-6 h-6 text-neutral-950" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Organic-O-Eats</span>
        </div>

        <div className="relative z-10 space-y-8">
           <motion.h1 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="text-6xl font-bold leading-[1.1] tracking-tight max-w-lg"
           >
             Manage your <span className="text-primary italic">Community</span> with Precision.
           </motion.h1>
           
           <div className="grid grid-cols-2 gap-8 max-w-md">
              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-primary font-bold">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Secure</span>
                 </div>
                 <p className="text-sm text-neutral-400">Enterprise grade security for all financial data.</p>
              </div>
              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-primary font-bold">
                    <CreditCard className="w-5 h-5" />
                    <span>Automated</span>
                 </div>
                 <p className="text-sm text-neutral-400">Zero-error split calculations and distribution.</p>
              </div>
           </div>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-sm text-neutral-400">
           <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-neutral-900 bg-neutral-800" />
              ))}
           </div>
           <p>Trusted by over 500+ investment group admins.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-background relative overflow-hidden">
        {/* Mobile decorative blobs */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 blur-[80px] lg:hidden" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-8 relative z-10"
        >
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to manage your organization dashboard</p>
          </div>

          <div className="space-y-4">
             <Button 
               onClick={handleLogin}
               disabled={isLoggingIn}
               className="w-full h-12 gap-3 text-base shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
             >
               {isLoggingIn ? (
                 <>
                   <Loader2 className="w-5 h-5 animate-spin" />
                   Connecting...
                 </>
               ) : (
                 <>
                   <LogIn className="w-5 h-5" /> Continue with Google
                 </>
               )}
             </Button>
             
             <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                   <div className="w-full border-t border-muted"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                   <span className="bg-background px-2 text-muted-foreground">Or legacy login</span>
                </div>
             </div>

             <div className="space-y-3">
                <Button variant="outline" className="w-full h-12" disabled>Email / Password</Button>
                <div className="flex items-center justify-between px-1">
                   <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground" disabled>Forgot password?</Button>
                   <Button variant="link" className="h-auto p-0 text-xs text-primary font-bold" disabled>Create Account</Button>
                </div>
             </div>
          </div>

          <div className="pt-8 text-center">
             <p className="text-[10px] text-muted-foreground leading-relaxed">
               By continuing, you agree to our Terms of Service and Privacy Policy. 
               Data is stored securely in Firebase encrypted clusters.
             </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function App() {
    const { user, initialized } = useAuthStore();
    const [activePage, setActivePage] = React.useState<PageId>('dashboard');
  
    if (!initialized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center space-y-6 bg-background">
        <div className="relative">
           <div className="w-16 h-16 rounded-2xl bg-primary/20 animate-pulse flex items-center justify-center">
             <TrendingUp className="w-8 h-8 text-primary animate-bounce" />
           </div>
           <div className="absolute -inset-4 bg-primary/10 blur-xl animate-pulse -z-10" />
        </div>
        <div className="text-center space-y-1">
           <p className="text-lg font-bold tracking-tight animate-pulse">Initializing Environment</p>
           <p className="text-xs text-muted-foreground">Authenticating with Organic-O-Eats secure tunnel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <Toaster position="top-right" expand />
      </>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'members': return <MembersPage />;
      case 'expenses': return <ExpensesPage />;
      case 'settlements': return <SettlementsPage />;
      case 'shares': return <SharesPage />;
      case 'income': return <PlaceholderPage title="Income Tracking" />;
      case 'tasks': return <PlaceholderPage title="Tasks & Kanban" />;
      case 'reports': return <PlaceholderPage title="Reports & Export" />;
      case 'settings': return <PlaceholderPage title="Organization Settings" />;
      default: return <Dashboard />;
    }
  };

  return (
    <Shell activePage={activePage} onPageChange={setActivePage}>
      {renderPage()}
      <Toaster position="top-right" expand />
    </Shell>
  );
}

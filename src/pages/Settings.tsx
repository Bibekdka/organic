import * as React from 'react';
import { 
  Settings, 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Database,
  Cloud,
  ChevronRight,
  Save,
  Loader2,
  Lock,
  Mail,
  User,
  LogOut
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export function SettingsPage() {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = React.useState(false);
  
  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Settings updated successfully');
    }, 1000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground shadow-sm">
            <Settings className="w-6 h-6" />
          </div>
          Organization Settings
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">Configure your community structure and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                General Information
              </CardTitle>
              <CardDescription>Primary identity details for your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" placeholder="Organic-O-Eats" defaultValue="Organic-O-Eats" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-id">Organization ID</Label>
                  <Input id="org-id" value="O-EATS-001" disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Base Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="location" className="pl-10" placeholder="Mumbai, India" defaultValue="Mumbai, India" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Input id="currency" value="INR (₹)" disabled className="bg-muted/50" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Governance & Privacy
              </CardTitle>
              <CardDescription>Control access rules and member permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Self-Registration</Label>
                    <p className="text-xs text-muted-foreground">Allow members to join via private invite link.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <Separator />
               <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Expense Visibility</Label>
                    <p className="text-xs text-muted-foreground">Members can see each other's split history.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <Separator />
               <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Settlement Notifications</Label>
                    <p className="text-xs text-muted-foreground">Broadcast alerts when debts are cleared.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card/50">
             <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                   <Database className="w-5 h-5 text-blue-500" />
                   Data Export
                </CardTitle>
                <CardDescription>Download a complete archive of your organization data.</CardDescription>
             </CardHeader>
             <CardContent className="flex items-center justify-between p-6 bg-blue-500/5 rounded-xl border border-dashed border-blue-500/20">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                      <Cloud className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="font-bold text-sm">Full Data Archive</p>
                      <p className="text-xs text-muted-foreground">Includes all expenses, members, and tasks.</p>
                   </div>
                </div>
                <Button size="sm" variant="outline">Prepare CSV</Button>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-sm bg-primary text-primary-foreground">
              <CardContent className="pt-6">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full border-2 border-primary-foreground/20 bg-background/10 flex items-center justify-center overflow-hidden">
                       {user?.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                       ) : (
                          <User className="w-6 h-6" />
                       )}
                    </div>
                    <div>
                       <p className="font-black truncate max-w-[150px]">{user?.displayName || 'Administrator'}</p>
                       <p className="text-xs opacity-70">Privileged Superuser</p>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs px-1">
                       <span className="opacity-70 flex items-center gap-2"><Mail className="w-3 h-3" /> Email</span>
                       <span className="font-medium truncate max-w-[120px]">{user?.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs px-1">
                       <span className="opacity-70 flex items-center gap-2"><Lock className="w-3 h-3" /> Auth Method</span>
                       <span className="font-medium">Google OAuth 2.0</span>
                    </div>
                 </div>
                 <Button onClick={handleLogout} variant="secondary" className="w-full mt-6 bg-white text-primary hover:bg-neutral-100 font-bold">
                    <LogOut className="w-4 h-4 mr-2" /> Log Out
                 </Button>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm bg-card/50">
              <CardContent className="pt-6 space-y-4">
                 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
                 <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-muted font-medium">
                       Security Logs <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-muted font-medium">
                       Invite Members <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" className="w-full justify-between text-foreground hover:bg-muted font-medium">
                       API Tokens <ChevronRight className="w-4 h-4" />
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-50">
        <Button 
          size="lg" 
          onClick={handleSave} 
          disabled={isSaving}
          className="shadow-2xl shadow-primary/30 h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black tracking-tight hover:scale-105 transition-all"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          {isSaving ? 'Applying Changes...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
}

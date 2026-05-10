import * as React from 'react';
import { 
  Users, 
  Receipt, 
  TrendingUp, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Sparkles,
  FileDown,
  FileSpreadsheet,
  Wallet
} from 'lucide-react';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from 'xlsx';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart as RePieChart
} from 'recharts';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { cn } from '@/lib/utils';
import { getSpendingInsights } from '@/services/geminiService';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { Plus } from 'lucide-react';

export function Dashboard() {
  const [stats, setStats] = React.useState({
    totalMembers: 0,
    totalSpent: 0,
    recentExpenses: [] as any[],
    allExpenses: [] as any[],
    members: [] as any[]
  });
  const [loading, setLoading] = React.useState(true);
  const [insights, setInsights] = React.useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = React.useState(false);
  const [isAddOpen, setIsAddOpen] = React.useState(false);

  React.useEffect(() => {
    // Listen to Members
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, totalMembers: snapshot.size, members }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'members'));

    // Listen to Expenses
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const total = expenses.reduce((sum, exp: any) => sum + exp.amount, 0);
      setStats(prev => ({ 
        ...prev, 
        totalSpent: total,
        recentExpenses: expenses.slice(0, 5),
        allExpenses: expenses
      }));
      setLoading(false);
      
      if (expenses.length > 0) {
        generateAIReview(expenses);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    return () => {
      unsubMembers();
      unsubExpenses();
    };
  }, []);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Organic-O-Eats - Full Financial Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = stats.allExpenses.map(exp => [
      exp.description,
      `₹${exp.amount.toLocaleString()}`,
      exp.date,
      stats.members.find(m => m.id === exp.paidBy)?.name || exp.paidBy,
      exp.category
    ]);

    (doc as any).autoTable({
      head: [['Description', 'Amount', 'Date', 'Paid By', 'Category']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`financial_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(stats.allExpenses.map(exp => ({
      Description: exp.description,
      Amount: exp.amount,
      Date: exp.date,
      PaidBy: stats.members.find(m => m.id === exp.paidBy)?.name || exp.paidBy,
      Category: exp.category,
      SplitType: exp.splitType
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `financial_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const memberBalances = React.useMemo(() => {
    const balances: Record<string, number> = {};
    stats.members.forEach(m => balances[m.id] = 0);
    stats.allExpenses.forEach((expense: any) => {
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
      expense.splits?.forEach((split: any) => {
        balances[split.memberId] = (balances[split.memberId] || 0) - split.amount;
      });
    });
    return Object.entries(balances)
      .map(([id, balance]) => ({
        id,
        name: stats.members.find(m => m.id === id)?.name || 'Unknown',
        balance
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [stats.members, stats.allExpenses]);

  const generateAIReview = async (expenses: any[]) => {
    if (loadingInsights) return;
    setLoadingInsights(true);
    try {
        const result = await getSpendingInsights(expenses);
        setInsights(result);
    } catch (error) {
        window.console.error("AI Insight error:", error);
    } finally {
        setLoadingInsights(false);
    }
  };

  const categoryData = React.useMemo(() => {
    const cats: Record<string, number> = {};
    stats.recentExpenses.forEach((exp: any) => {
        cats[exp.category] = (cats[exp.category] || 0) + exp.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [stats.recentExpenses]);

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

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
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
          <p className="text-muted-foreground text-sm">Here's what's happening with Organic-O-Eats today.</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm" className="gap-2 text-foreground">
                <FileDown className="w-4 h-4" /> Download Report
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-48">
                 <DropdownMenuItem onClick={handleExportPDF} className="gap-2 text-foreground">
                    <FileDown className="w-4 h-4 text-rose-500" /> Export PDF
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={handleExportExcel} className="gap-2 text-foreground">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Export Excel
                 </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
           <Button onClick={() => setIsAddOpen(true)} size="sm" className="shadow-lg shadow-primary/20 gap-2">
              <Plus className="w-4 h-4" /> Log Entry
           </Button>
           <Button size="sm" variant="ghost" className="hidden sm:flex text-muted-foreground">Refresh Insights</Button>
        </div>
      </div>

      <AddExpenseDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Active Members" 
          value={stats.totalMembers.toString()} 
          icon={<Users className="w-5 h-5" />} 
          color="bg-primary/10 text-primary"
        />
        <StatCard 
          title="Total Spent" 
          value={`₹${(stats.totalSpent / 1000).toFixed(stats.totalSpent >= 1000 ? 1 : 2)}k`} 
          icon={<Receipt className="w-5 h-5" />} 
          color="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard 
          title="Liability Score" 
          value={stats.totalSpent > 0 ? "8.4" : "0"} 
          icon={<AlertCircle className="w-5 h-5" />} 
          color="bg-amber-500/10 text-amber-500"
        />
        <StatCard 
          title="Net Cashflow" 
          value={stats.totalSpent > 0 ? "Positive" : "Stable"} 
          icon={<TrendingUp className="w-5 h-5" />} 
          color="bg-rose-500/10 text-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card className="lg:col-span-1 border-none shadow-md bg-card/50">
            <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <Wallet className="w-5 h-5 text-primary" />
                  Real-Time Balances
               </CardTitle>
               <CardDescription>Net member standing across all expenses.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {memberBalances.map((mb) => (
                     <div key={mb.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/5 border border-transparent hover:border-primary/10 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                              {mb.name[0]}
                           </div>
                           <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">{mb.name}</span>
                        </div>
                        <div className="text-right">
                           <p className={cn(
                              "text-sm font-black",
                              mb.balance >= 0 ? "text-emerald-500" : "text-rose-500"
                           )}>
                              {mb.balance >= 0 ? '+' : ''}₹{Math.abs(mb.balance).toLocaleString()}
                           </p>
                           <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                              {mb.balance >= 0 ? 'To Receive' : 'To Pay'}
                           </p>
                        </div>
                     </div>
                  ))}
               </div>
            </CardContent>
         </Card>

         <div className="lg:col-span-2 space-y-6">
            <Card className="border-none bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md overflow-hidden relative group">
               <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                     <Sparkles className="w-5 h-5 text-primary" />
                     <CardTitle className="text-lg text-foreground font-bold">AI Financial Review</CardTitle>
                  </div>
                  <CardDescription>Generated based on real-time organization data.</CardDescription>
               </CardHeader>
               <CardContent>
                  {loadingInsights ? (
                     <div className="flex items-center gap-2 text-muted-foreground py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm italic">Gemini is analyzing your spending patterns...</span>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.map((insight, index) => (
                           <div key={index} className="flex gap-3 bg-card/40 backdrop-blur-md p-3 rounded-lg border border-primary/10 hover:border-primary/30 transition-all">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                              <p className="text-xs leading-relaxed text-foreground/90">{insight}</p>
                           </div>
                        ))}
                        {insights.length === 0 && (
                           <p className="text-xs text-muted-foreground py-2 italic font-medium">Log more expenses to get personalized AI insights.</p>
                        )}
                     </div>
                  )}
               </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card/50">
               <CardHeader>
                  <CardTitle className="text-lg text-foreground">Spending Mix</CardTitle>
                  <CardDescription>Distribution across categories.</CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="h-[240px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                           <Pie
                              data={categoryData.length > 0 ? categoryData : [{ name: 'None', value: 1 }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                           >
                              {categoryData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                              {categoryData.length === 0 && <Cell fill="#334155" />}
                           </Pie>
                        </RePieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                     {categoryData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs text-foreground">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                           <span className="font-medium text-muted-foreground">{item.name}:</span>
                           <span className="font-bold">₹{item.value.toLocaleString()}</span>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-md bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Recent Trend</CardTitle>
            <CardDescription>Expenditure flow of latest records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...stats.recentExpenses].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="amount" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md bg-card/50">
         <CardHeader className="flex flex-row items-center justify-between">
            <div>
               <CardTitle className="text-lg text-foreground">Recent Activity</CardTitle>
               <CardDescription>Latest expenses logged across the organization.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
         </CardHeader>
         <CardContent>
            <div className="space-y-4">
               {stats.recentExpenses.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-muted-foreground/10 group">
                     <div className="flex items-center gap-4">
                        <div className={cn(
                           "w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20",
                           "bg-primary"
                        )}>
                           <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{exp.description}</p>
                           <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{exp.category} • {exp.date}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-sm font-black text-foreground">₹{exp.amount.toLocaleString()}</p>
                        <Badge variant="outline" className="text-[9px] py-0 border-primary/20 text-primary bg-primary/5 capitalize">{exp.splitType}</Badge>
                     </div>
                  </div>
               ))}
               {stats.recentExpenses.length === 0 && (
                 <div className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-2 opacity-10" />
                    <p>No transactions yet.</p>
                 </div>
               )}
            </div>
         </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendType, color }: any) {
  return (
    <Card className="border-none shadow-md relative overflow-hidden bg-white/5 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-xl", color)}>
            {icon}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full",
              trendType === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
              {trendType === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {trend}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
          <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

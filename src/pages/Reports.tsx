import * as React from 'react';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Download, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function ReportsPage() {
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState('last_30_days');

  React.useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    return unsub;
  }, []);

  const categoryData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach(exp => {
      counts[exp.category] = (counts[exp.category] || 0) + exp.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const monthlyTrends = React.useMemo(() => {
    const trends: Record<string, number> = {};
    expenses.forEach(exp => {
      const month = exp.date.substring(0, 7); // YYYY-MM
      trends[month] = (trends[month] || 0) + exp.amount;
    });
    return Object.entries(trends)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, amount]) => ({ name, amount }));
  }, [expenses]);

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
              <BarChart3 className="w-6 h-6" />
            </div>
            Analytics & Reports
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Financial insights and expenditure oversight.</p>
        </div>
        <div className="flex gap-2">
           <Select value={timeRange} onValueChange={setTimeRange}>
             <SelectTrigger className="w-[180px] bg-card border-none shadow-sm text-foreground">
               <SelectValue placeholder="Time Range" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="last_7_days">Last 7 Days</SelectItem>
               <SelectItem value="last_30_days">Last 30 Days</SelectItem>
               <SelectItem value="this_month">This Month</SelectItem>
               <SelectItem value="all_time">All Time</SelectItem>
             </SelectContent>
           </Select>
           <Button variant="outline" className="gap-2 bg-card border-none shadow-sm text-foreground">
             <Download className="w-4 h-4" /> Export
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Expenditure</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-emerald-500">
              <ArrowUpRight className="w-3 h-3" />
              <span>12.5% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Average</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">₹{(expenses.reduce((sum, e) => sum + e.amount, 0) / (monthlyTrends.length || 1)).toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-rose-500">
              <ArrowDownRight className="w-3 h-3" />
              <span>4.2% from average</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Largest Category</p>
                <h3 className="text-xl font-black mt-1 text-foreground truncate max-w-[120px]">
                  {categoryData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <PieChartIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground font-medium">Dominates 42% of total spend</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transactions</p>
                <h3 className="text-2xl font-black mt-1 text-foreground">{expenses.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                 <Filter className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground font-medium">Since organization start</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-lg bg-card/80 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Expenditure Trend</CardTitle>
            <CardDescription>Monthly spending patterns across all categories.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#888' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#888' }}
                    tickFormatter={(val) => `₹${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-card/80 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>Spend breakdown by budget type.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] flex flex-col items-center justify-center">
             <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg bg-card/80 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
                <CardTitle>Member Spending Comparison</CardTitle>
                <CardDescription>Individual contribution levels and paid amounts.</CardDescription>
             </div>
             <Tabs defaultValue="bar">
                <TabsList className="bg-secondary/20">
                   <TabsTrigger value="bar">Bar</TabsTrigger>
                   <TabsTrigger value="area">List</TabsTrigger>
                </TabsList>
             </Tabs>
          </div>
        </CardHeader>
        <CardContent className="h-[350px]">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
           </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

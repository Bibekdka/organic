export type User = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
  avatarUrl?: string;
};

export type Society = {
  id: string;
  name: string;
  description: string;
  currency: string;
  admins: string[];
  createdAt: number;
  rules: {
    defaultSplitType: SplitType;
  };
};

export type Member = {
  id: string;
  societyId: string;
  userId?: string;
  name: string;
  email?: string;
  role: 'admin' | 'member' | 'president' | 'secretary' | 'promoter';
  status: 'active' | 'inactive';
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  aadharNo?: string;
  panNo?: string;
  phone?: string;
  joinedAt: number;
  shares: number; // Added this
  avatarUrl?: string; // Permanant avatar
};

export type SplitType = 'equal' | 'percentage' | 'custom' | 'shares';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type Split = {
  memberId: string;
  amount: number;
  percentage?: number;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  paidBy: string; // memberId
  date: string;
  splitType: SplitType;
  splits: Split[];
  createdAt: any;
  createdBy?: string;
  createdByName?: string;
  updatedByName?: string;
  isRecurring?: boolean;
  recurringFrequency?: Frequency;
};

export type RecurringTemplate = {
  id: string;
  description: string;
  amount: number;
  category: string;
  paidBy: string;
  splitType: SplitType;
  splits: Split[];
  frequency: Frequency;
  nextExecutionDate: number;
  lastExecutedAt?: number;
  active: boolean;
};

export type Share = {
  id: string;
  societyId: string;
  memberId: string;
  percentage: number;
  units: number;
  updatedAt: number;
};

export type ShareTransaction = {
  id: string;
  memberId: string;
  previousUnits: number;
  newUnits: number;
  change: number;
  reason: string;
  createdAt: any;
};

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export type Income = {
  id: string;
  source: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  createdAt: any;
  createdBy: string;
  createdByName?: string;
  updatedByName?: string;
};

export type Task = {
  id: string;
  societyId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string; // memberId
  dueDate?: number;
  createdAt: number;
  createdByName?: string;
  updatedByName?: string;
};

export type OnboardingRecord = {
  id: string;
  name: string;
  email?: string;
  suggestedRole: Member['role'];
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  aadharNo?: string;
  panNo?: string;
  phone?: string;
  notes?: string;
  shares?: number;
  createdAt: any;
  createdByName?: string;
  updatedByName?: string;
};

export type AppSettings = {
  id: string;
  sharePrice: number;
  monthlySpentTarget?: number;
  updatedAt: number;
};

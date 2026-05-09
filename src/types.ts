export type User = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
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
  email: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  joinedAt: number;
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

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

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
};

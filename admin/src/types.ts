export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'read' | 'in_progress' | 'resolved' | 'archived';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  subject: string;
  message: string;
  rating: number | null;
  submittedAt: string;
  userId: string | null;
  userEmail: string | null;
  adminNote: string | null;
  resolvedAt: string | null;
}

export interface FeedbackStats {
  total: number;
  byType: Record<FeedbackType, number>;
  byStatus: Record<FeedbackStatus, number>;
  averageRating: number | null;
  recentCount: number; // last 7 days
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUser {
  email: string;
  token: string;
}

export interface UserItem {
  userId: string;
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

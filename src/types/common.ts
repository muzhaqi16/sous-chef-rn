// Common shared types used across the application

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

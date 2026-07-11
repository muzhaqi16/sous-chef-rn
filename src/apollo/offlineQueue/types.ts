import { DocumentNode } from 'graphql';
import type { DefaultContext, OperationVariables } from '@apollo/client';

/**
 * Status of a queued mutation
 */
export enum QueueStatus {
  PENDING = 'pending', // Waiting to be processed
  PROCESSING = 'processing', // Currently being sent to server
  FAILED = 'failed', // Failed after retries (network/server error)
  AUTH_ERROR = 'auth_error', // Failed due to authentication issues
  SUCCESS = 'success', // Successfully processed (kept briefly for reconciliation)
}

/**
 * Error information for failed mutations
 */
export interface QueueError {
  type: 'network' | 'auth' | 'server' | 'unknown';
  message: string;
  code?: string;
  timestamp: number;
  retryable: boolean;
}

/**
 * A queued mutation waiting to be processed
 */
export interface QueuedMutation {
  // Identification
  id: string; // UUID for tracking
  userId: string; // User who created the mutation (critical for auth)
  operationName: string; // GraphQL operation name for debugging

  // Mutation details
  mutation: DocumentNode; // GraphQL mutation document
  variables: OperationVariables; // Mutation variables
  context?: DefaultContext; // Allowlisted replay context (localFirst)

  // Status tracking
  status: QueueStatus;
  createdAt: number; // Timestamp when added to queue
  updatedAt: number; // Last status update timestamp
  processedAt?: number; // When successfully processed

  // Retry logic
  retryCount: number; // Number of retry attempts
  maxRetries: number; // Maximum retries before marking as failed
  lastError?: QueueError; // Last error encountered

  // Auth
  requiresAuth: boolean; // Whether mutation requires authentication
}

/**
 * Statistics about the mutation queue
 */
export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  authErrors: number;
  oldestMutationAge?: number; // Age of oldest pending mutation in ms
}

/**
 * Configuration for the queue manager. (Queue size is bounded in queueStore;
 * per-mutation max retries ride on each QueuedMutation.)
 */
export interface QueueConfig {
  retryDelayMs: number; // Delay between retries (with exponential backoff)
  processingTimeoutMs: number; // Timeout for individual mutation processing
}

/**
 * Result of processing a queued mutation
 */
export interface ProcessingResult {
  success: boolean;
  mutationId: string;
  error?: QueueError;
  serverResponse?: Record<string, unknown>;
}

/**
 * Information about a permanently failed mutation, passed to the failure handler
 */
export interface FailedMutationInfo {
  mutationId: string;
  operationName: string;
  entityType: string | null;
  entityId: string | null;
  error: QueueError;
}

/**
 * Callback invoked when a mutation permanently fails after exhausting retries
 */
export type FailureHandler = (info: FailedMutationInfo) => void;

/**
 * Debug utilities for the offline mutation queue
 * Only available in development builds
 */

import { queueStore } from './queueStore';
import { queueManager } from './queueManager';
import { useStore } from '#store';
import { QueueStatus } from './types';

export interface QueueDebugTools {
  // Queue inspection
  viewQueue: () => void;
  viewQueueForUser: (userId: string) => void;
  getQueueStats: (userId?: string) => void;

  // Queue manipulation
  clearQueue: () => void;
  clearQueueForUser: (userId: string) => void;

  // Queue processing
  processQueue: () => Promise<void>;
  retryFailedMutations: (userId: string) => void;

  // Export/Import
  exportQueue: () => string;

  // Network simulation
  simulateOffline: () => void;
  simulateOnline: () => void;
}

const queueDebug: QueueDebugTools = {
  /**
   * View the entire queue in console
   */
  viewQueue: () => {
    const state = useStore.getState();
    const userId = state.user?.id;

    if (!userId) {
      console.log('❌ No authenticated user');
      return;
    }

    const mutations = queueStore.getMutationsForUser(userId);
    console.log('📋 Offline Mutation Queue:');
    console.log(`   User: ${userId}`);
    console.log(`   Total: ${mutations.length}`);
    console.log('');

    if (mutations.length === 0) {
      console.log('   (empty)');
      return;
    }

    mutations.forEach((mutation, index) => {
      console.log(`   [${index + 1}] ${mutation.operationName}`);
      console.log(`       ID: ${mutation.id}`);
      console.log(`       Status: ${mutation.status}`);
      console.log(`       Created: ${new Date(mutation.createdAt).toLocaleString()}`);
      console.log(`       Retries: ${mutation.retryCount}/${mutation.maxRetries}`);
      if (mutation.lastError) {
        console.log(`       Error: ${mutation.lastError.message}`);
      }
      console.log('');
    });
  },

  /**
   * View queue for specific user
   */
  viewQueueForUser: (userId: string) => {
    const mutations = queueStore.getMutationsForUser(userId);
    console.log(`📋 Queue for user ${userId}:`);
    console.log(`   Total: ${mutations.length}`);

    mutations.forEach((mutation, index) => {
      console.log(`   [${index + 1}] ${mutation.operationName} - ${mutation.status}`);
    });
  },

  /**
   * Get queue statistics
   */
  getQueueStats: (userId?: string) => {
    const state = useStore.getState();
    const targetUserId = userId || state.user?.id;

    if (!targetUserId) {
      console.log('❌ No user specified and no authenticated user');
      return;
    }

    const stats = queueManager.getStats(targetUserId);
    console.log('📊 Queue Statistics:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Auth Errors: ${stats.authErrors}`);

    if (stats.oldestMutationAge) {
      const ageMinutes = Math.round(stats.oldestMutationAge / 1000 / 60);
      console.log(`   Oldest: ${ageMinutes} minutes ago`);
    }
  },

  /**
   * Clear the entire queue
   */
  clearQueue: () => {
    // Note: In React Native, you would use Alert.alert for confirmation
    // For debugging purposes, we'll just clear directly in dev mode
    queueStore.clearAllQueues();
    console.log('✅ Queue cleared');
  },

  /**
   * Clear queue for specific user
   */
  clearQueueForUser: (userId: string) => {
    const count = queueStore.clearQueueForUser(userId);
    console.log(`✅ Cleared ${count} mutations for user ${userId}`);
  },

  /**
   * Manually trigger queue processing
   */
  processQueue: async () => {
    console.log('🔄 Manually processing queue...');
    await queueManager.processQueue();
    console.log('✅ Queue processing complete');
  },

  /**
   * Retry all failed mutations for a user
   */
  retryFailedMutations: (userId: string) => {
    const mutations = queueStore.getMutationsForUser(userId, QueueStatus.FAILED);

    console.log(`🔄 Retrying ${mutations.length} failed mutations...`);

    mutations.forEach(mutation => {
      queueStore.updateMutation(mutation.id, {
        status: QueueStatus.PENDING,
        retryCount: 0, // Reset retry count
      });
    });

    console.log('✅ Failed mutations reset to pending');

    // Trigger queue processing if online
    const state = useStore.getState();
    if (state.isOnline) {
      queueManager.processQueue();
    } else {
      console.log('📴 Still offline, mutations will process when online');
    }
  },

  /**
   * Export queue as JSON for debugging
   */
  exportQueue: () => {
    const state = useStore.getState();
    const userId = state.user?.id;

    if (!userId) {
      console.log('❌ No authenticated user');
      return '';
    }

    const mutations = queueStore.getMutationsForUser(userId);
    const exported = JSON.stringify(mutations, null, 2);

    console.log('📤 Queue exported to console:');
    console.log(exported);

    return exported;
  },

  /**
   * Simulate offline mode (for testing)
   */
  simulateOffline: () => {
    useStore.getState().setOffline();
    console.log('📴 Simulated offline mode');
  },

  /**
   * Simulate online mode (for testing)
   */
  simulateOnline: () => {
    useStore.getState().setOnline();
    console.log('📡 Simulated online mode');
    queueManager.processQueue();
  },
};

// Expose debug tools in development only
if (__DEV__) {
  // @ts-ignore - Debug tools available via __QUEUE_DEBUG__ in dev console
  global.__QUEUE_DEBUG__ = queueDebug;
}

export { queueDebug };

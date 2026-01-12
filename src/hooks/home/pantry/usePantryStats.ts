/**
 * usePantryStats - Statistics and computed values for pantry items
 *
 * Single responsibility:
 * - Calculate pantry statistics
 * - Compute location counts
 * - Section items by expiration status
 * - Helper functions for filtering
 */

import { useMemo, useCallback } from 'react';
import { StorageState } from '#generated';
import type { PantryStats, LocationCounts, SectionedItems } from './types';

/**
 * Hook for computing pantry statistics and derived data
 *
 * @example
 * ```tsx
 * const { stats, locationCounts, sectionedItems, getExpiredItems } = usePantryStats(pantryItems);
 * ```
 */
export function usePantryStats(pantryItems: any[]) {
  // Simple stats calculation
  const stats = useMemo<PantryStats>(() => {
    if (!pantryItems || pantryItems.length === 0) {
      return {
        total: 0,
        expired: 0,
        expiringSoon: 0,
        lowStock: 0,
      };
    }

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expired = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    }).length;

    const expiringSoon = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      const expirationDate = new Date(item.expiresAt);
      return expirationDate >= now && expirationDate <= sevenDaysFromNow;
    }).length;

    const lowStock = pantryItems.filter(item => {
      // Consider low stock if quantity is 1 or less, or if lowStockAlert flag is set
      return item.quantity <= 1 || item.lowStockAlert;
    }).length;

    return {
      total: pantryItems.length,
      expired,
      expiringSoon,
      lowStock,
    };
  }, [pantryItems]);

  // Location counts for filter tabs
  const locationCounts = useMemo<LocationCounts>(() => {
    if (!pantryItems || pantryItems.length === 0) {
      return {
        all: 0,
        fridge: 0,
        freezer: 0,
        pantry: 0,
      };
    }

    return {
      all: pantryItems.length,
      fridge: pantryItems.filter(
        item => item.storageState === StorageState.Refrigerated,
      ).length,
      freezer: pantryItems.filter(
        item => item.storageState === StorageState.Frozen,
      ).length,
      pantry: pantryItems.filter(
        item => item.storageState === StorageState.Ambient || !item.storageState,
      ).length,
    };
  }, [pantryItems]);

  // Sectioned items for redesign
  const sectionedItems = useMemo<SectionedItems>(() => {
    if (!pantryItems || pantryItems.length === 0) {
      return {
        expiredItems: [],
        expiringSoonItems: [],
        normalItems: [],
      };
    }

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiredItems = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    });

    const expiringSoonItems = pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      const expirationDate = new Date(item.expiresAt);
      return expirationDate >= now && expirationDate <= threeDaysFromNow;
    });

    // normalItems includes everything except "expiring soon" items
    const normalItems = pantryItems.filter(item => {
      if (!item.expiresAt) return true; // Items without expiry go to normal
      const expirationDate = new Date(item.expiresAt);
      const isExpiringSoon = expirationDate >= now && expirationDate <= threeDaysFromNow;
      return !isExpiringSoon;
    });

    return {
      expiredItems,
      expiringSoonItems,
      normalItems,
    };
  }, [pantryItems]);

  // Helper functions
  const getItemById = useCallback(
    (itemId: string) => pantryItems.find(item => item.id === itemId),
    [pantryItems],
  );

  const getItemsByStorageState = useCallback(
    (storageState: StorageState) =>
      pantryItems.filter(item => item.storageState === storageState),
    [pantryItems],
  );

  const getExpiringItems = useCallback(
    (days: number = 7) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return pantryItems.filter(item => {
        if (!item.expiresAt) return false;
        const expirationDate = new Date(item.expiresAt);
        return expirationDate <= futureDate;
      });
    },
    [pantryItems],
  );

  const getLowStockItems = useCallback(
    () =>
      pantryItems.filter(item => {
        return item.quantity <= 1 || item.lowStockAlert;
      }),
    [pantryItems],
  );

  const getExpiredItems = useCallback(() => {
    const now = new Date();
    return pantryItems.filter(item => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt) < now;
    });
  }, [pantryItems]);

  return {
    stats,
    locationCounts,
    sectionedItems,

    // Helper functions
    getItemById,
    getItemsByStorageState,
    getExpiringItems,
    getLowStockItems,
    getExpiredItems,
  };
}

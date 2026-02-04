import { useState, useCallback, useEffect } from 'react';
import type { AddItemSheetState } from './types';

interface UseAddItemSheetStateOptions {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Context ID (pantryId or shoppingListId) */
  contextId: string | undefined;
  /** Whether to defer fetch (for animation performance) */
  deferFetch?: boolean;
  /** Delay in ms before enabling fetch (default: 50) */
  deferDelayMs?: number;
}

/**
 * Shared state management hook for AddItemSheet.
 *
 * Manages:
 * - Search query state
 * - Deferred fetch state (for smooth animations)
 * - Exit animation tracking
 * - Search/suggestion display logic
 */
export function useAddItemSheetState({
  visible,
  contextId,
  deferFetch = true,
  deferDelayMs = 50,
}: UseAddItemSheetStateOptions): AddItemSheetState {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Deferred fetch state - delays query execution until sheet animation completes
  const [shouldFetch, setShouldFetch] = useState(false);

  // Track items currently animating out
  const [exitingItems, setExitingItems] = useState<Set<string>>(new Set());

  // Control deferred fetch based on visibility
  useEffect(() => {
    if (visible && contextId) {
      // Reset state on open
      setSearchQuery('');
      setExitingItems(new Set());

      if (deferFetch) {
        // Defer fetch until after sheet animation
        const timer = setTimeout(() => setShouldFetch(true), deferDelayMs);
        return () => clearTimeout(timer);
      } else {
        setShouldFetch(true);
      }
    } else {
      // Reset on close
      setShouldFetch(false);
    }
  }, [visible, contextId, deferFetch, deferDelayMs]);

  // Start exit animation for an item
  const startExitAnimation = useCallback((itemId: string) => {
    setExitingItems(prev => new Set(prev).add(itemId));
  }, []);

  // Complete exit animation and remove from tracking
  const completeExitAnimation = useCallback((itemId: string) => {
    setExitingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  // Determine what to show based on search query
  const showSearchResults = searchQuery.length >= 2;
  const showSuggestions = !showSearchResults;

  return {
    searchQuery,
    setSearchQuery,
    shouldFetch,
    exitingItems,
    startExitAnimation,
    completeExitAnimation,
    showSearchResults,
    showSuggestions,
  };
}

import { useState, useEffect } from 'react';
import type { AddItemSheetState } from './types';

interface UseAddItemSheetStateOptions {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Context ID (pantryId or shoppingListId) */
  contextId: string | undefined;
  /** Whether to defer fetch (for animation performance) */
  deferFetch?: boolean;
}

// RENDER_SUGGESTIONS_DELAY_MS removed — now uses requestIdleCallback to wait for sheet animation

/**
 * Shared state management hook for AddItemSheet.
 *
 * Manages:
 * - Search query state
 * - Deferred fetch state (for smooth animations)
 * - Deferred suggestion rendering (avoids jank during sheet open)
 * - Exit animation tracking
 * - Search/suggestion display logic
 */
export function useAddItemSheetState({
  visible,
  contextId,
  deferFetch = true }: UseAddItemSheetStateOptions): AddItemSheetState {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Deferred fetch state - delays query execution until sheet animation completes
  const [shouldFetch, setShouldFetch] = useState(false);

  // Track items currently animating out
  const [exitingItems, setExitingItems] = useState<Set<string>>(new Set());

  // Deferred rendering — waits for sheet animation to finish before rendering suggestions
  const [shouldRenderSuggestions, setShouldRenderSuggestions] = useState(false);

  // Render-time state reset: track previous visibility to detect open/close transitions
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevContextId, setPrevContextId] = useState(contextId);

  if (visible !== prevVisible || contextId !== prevContextId) {
    setPrevVisible(visible);
    setPrevContextId(contextId);

    if (visible && contextId) {
      // Reset state on open
      setSearchQuery('');
      setExitingItems(new Set());
      setShouldRenderSuggestions(false);
      if (!deferFetch) {
        setShouldFetch(true);
        setShouldRenderSuggestions(true);
      }
    } else {
      // Reset on close
      setShouldFetch(false);
      setShouldRenderSuggestions(false);
    }
  }

  // Control deferred fetch based on visibility
  useEffect(() => {
    if (visible && contextId && deferFetch) {
      // Defer fetch until after current frame (don't block sheet animation)
      const rafId = requestAnimationFrame(() => setShouldFetch(true));
      // Defer suggestion rendering until idle (sheet animation settled)
      const idleId = requestIdleCallback(() => setShouldRenderSuggestions(true));
      return () => {
        cancelAnimationFrame(rafId);
        cancelIdleCallback(idleId);
      };
    }
  }, [visible, contextId, deferFetch]);

  // Start exit animation for an item
  const startExitAnimation = (itemId: string) => {
    setExitingItems(prev => new Set(prev).add(itemId));
  };

  // Complete exit animation and remove from tracking
  const completeExitAnimation = (itemId: string) => {
    setExitingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  // Determine what to show based on search query
  const showSearchResults = searchQuery.length >= 2;
  const showSuggestions = !showSearchResults;

  return {
    searchQuery,
    setSearchQuery,
    shouldFetch,
    shouldRenderSuggestions,
    exitingItems,
    startExitAnimation,
    completeExitAnimation,
    showSearchResults,
    showSuggestions };
}

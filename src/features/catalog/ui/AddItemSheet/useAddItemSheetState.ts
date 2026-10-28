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

/**
 * Shared state for AddItemSheet. Fetching and suggestion rendering are deferred
 * past the sheet's open animation via `requestIdleCallback`.
 */
export function useAddItemSheetState({
  visible,
  contextId,
  deferFetch = true,
}: UseAddItemSheetStateOptions): AddItemSheetState {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Deferred fetch state - delays query execution until sheet animation completes
  const [shouldFetch, setShouldFetch] = useState(false);

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
      const idleId = requestIdleCallback(() =>
        setShouldRenderSuggestions(true),
      );
      return () => {
        cancelAnimationFrame(rafId);
        cancelIdleCallback(idleId);
      };
    }
  }, [visible, contextId, deferFetch]);

  return {
    searchQuery,
    setSearchQuery,
    shouldFetch,
    shouldRenderSuggestions,
  };
}

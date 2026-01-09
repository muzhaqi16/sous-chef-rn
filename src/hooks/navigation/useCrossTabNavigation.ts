import { useCallback } from 'react';
import { useAppNavigation } from './useAppNavigation';

export type SourceTab = 'Pantry' | 'ShoppingList' | 'Recipe';

export interface CrossTabSource {
  sourceTab?: SourceTab;
  sourceScreen?: string;
  sourceParams?: Record<string, any>;
}

/**
 * Hook for handling cross-tab navigation with proper stack cleanup.
 *
 * When navigating between tabs (e.g., Pantry → Recipe), the destination
 * stack accumulates screens. This hook ensures proper cleanup when
 * navigating back to the source tab.
 *
 * @param currentMainScreen - The main screen of the current stack (e.g., 'RecipeMain')
 *                            Used to reset the stack when navigating away
 */
export function useCrossTabNavigation(currentMainScreen: string) {
  const { goBack, navigateToNested, replace } = useAppNavigation();

  /**
   * Navigate back to the source tab, cleaning up the current stack.
   * If no source is provided, uses normal goBack().
   */
  const goBackToSource = useCallback((source?: CrossTabSource) => {
    if (!source?.sourceTab) {
      // No cross-tab source, use normal back
      goBack();
      return;
    }

    // Replace current screen with main screen to clean the stack
    replace(currentMainScreen, undefined);

    // Navigate to source tab
    const mainScreenName = `${source.sourceTab}Main`;

    if (source.sourceScreen && source.sourceParams) {
      // Navigate to specific screen with params
      navigateToNested(source.sourceTab, source.sourceScreen, source.sourceParams);
    } else {
      // Navigate to main screen of source tab
      navigateToNested(source.sourceTab, mainScreenName, undefined);
    }
  }, [currentMainScreen, goBack, navigateToNested, replace]);

  return { goBackToSource };
}

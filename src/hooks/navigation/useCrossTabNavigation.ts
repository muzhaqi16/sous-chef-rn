import { useCallback } from 'react';
import { CommonActions } from '@react-navigation/native';
import { useAppNavigation } from './useAppNavigation';

export type SourceTab = 'Pantry' | 'ShoppingList' | 'Recipe';

export interface CrossTabSource {
  sourceTab?: SourceTab;
  sourceScreen?: string;
  sourceParams?: Record<string, any>;
  /** Set to true when navigating from a modal stack (like Barcode) that needs full reset */
  fromModalStack?: boolean;
}

/**
 * Hook for handling cross-tab navigation with proper stack cleanup.
 *
 * For tab-to-tab navigation (e.g., Recipe tab → Pantry tab), uses standard goBack().
 * For modal-to-tab navigation (e.g., Barcode modal → Pantry tab), uses reset to dismiss modal.
 *
 * Note: Tab stack reset on tab press is handled by FloatingTabBar.
 *
 * @param _currentMainScreen - Deprecated: no longer used but kept for API compatibility
 */
export function useCrossTabNavigation(_currentMainScreen: string) {
  const { goBack, navigation } = useAppNavigation();

  /**
   * Navigate back to the source tab.
   * - For intra-Home navigation (tab to tab): uses standard goBack()
   * - For modal dismissal (fromModalStack: true): uses reset to fully dismiss modal
   */
  const goBackToSource = useCallback((source?: CrossTabSource) => {
    if (!source?.sourceTab) {
      // No cross-tab source, use normal back
      goBack();
      return;
    }

    // For tab-to-tab navigation within Home, just use goBack()
    // The FloatingTabBar will reset the stack when user taps the tab later
    if (!source.fromModalStack) {
      goBack();
      return;
    }

    // Modal dismissal scenario - use reset to fully dismiss the modal stack
    const mainScreenName = source.sourceScreen || `${source.sourceTab}Main`;
    const rootNavigator = navigation.getParent();

    if (rootNavigator) {
      rootNavigator.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Home',
              state: {
                routes: [
                  {
                    name: source.sourceTab,
                    state: {
                      routes: [
                        {
                          name: mainScreenName,
                          params: source.sourceParams,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        })
      );
    } else {
      // Fallback: if no parent navigator, try normal goBack
      goBack();
    }
  }, [goBack, navigation]);

  return { goBackToSource };
}

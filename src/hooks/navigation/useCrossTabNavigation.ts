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
 * For modal-to-tab navigation (e.g., Barcode modal → Pantry tab), uses navigate to dismiss modal.
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
   * - For modal dismissal (fromModalStack: true): uses navigate to dismiss modal and preserve state
   */
  const goBackToSource = (source?: CrossTabSource) => {
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

    // Modal dismissal scenario - navigate instead of reset to preserve state
    const rootNavigator = navigation.getParent();

    if (rootNavigator) {
      // Navigate to Home with the specific tab
      // This dismisses the modal and activates the correct tab without resetting
      rootNavigator.dispatch(
        CommonActions.navigate({
          name: 'Home',
          params: {
            screen: source.sourceTab,
            // Don't specify nested screen params - preserve the tab's current state
          } })
      );
    } else {
      goBack();
    }
  };

  return { goBackToSource };
}

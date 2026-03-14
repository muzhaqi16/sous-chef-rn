import { useEffect, useRef } from 'react';
import { alertService } from '#/services/alertService';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { BarcodeSource } from '#/types/navigation';

export interface ScannerContext {
  source: BarcodeSource;
  pantryId?: string;
  listId?: string;
  shoppingListId?: string;
}

interface UseScannerSetupOptions {
  /**
   * Whether scanner setup is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Home ID required to scan
   * If not provided, scanner will show error
   */
  homeId?: string | null;

  /**
   * Context passed to scanner navigation
   * Must include source and optional ids
   */
  context: ScannerContext;

  /**
   * Custom error handling when home is not selected
   */
  onNoHome?: () => void;
}

/**
 * Hook to set up scanner button functionality
 *
 * Handles:
 * - Scanner button setup and cleanup
 * - Home validation before scanning
 * - Navigation to barcode scanner with context
 * - Error alerts for missing home
 *
 * @example
 * ```typescript
 * useScannerSetup({
 *   enabled: true,
 *   homeId: selectedHomeId,
 *   context: {
 *     source: 'pantry',
 *     pantryId: pantry?.id,
 *   },
 * });
 * ```
 */
export function useScannerSetup(options: UseScannerSetupOptions): void {
  const { enabled = true, homeId, context, onNoHome } = options;

  const { setScannerProps } = useTabBarSetters();
  const { navigate, navigateTo } = useAppNavigation();

  // Use refs to track dynamic values without triggering effect re-runs
  const homeIdRef = useRef(homeId);
  const contextRef = useRef(context);
  const onNoHomeRef = useRef(onNoHome);

  // Update refs when values change
  useEffect(() => {
    homeIdRef.current = homeId;
  }, [homeId]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    onNoHomeRef.current = onNoHome;
  }, [onNoHome]);

  // Set up scanner button
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleScanPress = () => {
      // Validate home selection
      if (!homeIdRef.current) {
        if (onNoHomeRef.current) {
          onNoHomeRef.current();
        } else {
          alertService.alert(
            'No Home Selected',
            'You need to be a member of a home to scan items.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Manage Homes',
                onPress: () => navigate('HomeManagement'),
                style: 'default',
              },
            ],
          );
        }
        return;
      }

      // Navigate to barcode scanner with context
      navigateTo.barcode(contextRef.current);
    };

    setScannerProps(handleScanPress, true);

    // Clean up on unmount
    return () => {
      setScannerProps(undefined, false);
    };
  }, [enabled, setScannerProps, navigate, navigateTo]);
}

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useCanUseNetwork } from '#hooks/settings/useOfflineMode';

/**
 * Hook for disabling actions when offline.
 *
 * Provides a disabled state and a helper to show an alert
 * explaining that the feature requires network connectivity.
 *
 * @param customMessage - Optional custom message for the alert
 *
 * @example
 * ```tsx
 * const { isDisabled, showOfflineMessage } = useOfflineDisabled();
 *
 * <Button
 *   onPress={isDisabled ? showOfflineMessage : handleShare}
 *   disabled={isDisabled}
 * >
 *   Share
 * </Button>
 * ```
 *
 * @example
 * ```tsx
 * // With custom message
 * const { isDisabled, showOfflineMessage } = useOfflineDisabled(
 *   'Sharing requires an active internet connection'
 * );
 * ```
 */
export function useOfflineDisabled(customMessage?: string) {
  const canUseNetwork = useCanUseNetwork();

  const showOfflineMessage = useCallback(() => {
    Alert.alert(
      'Offline',
      customMessage ?? 'This feature requires an internet connection'
    );
  }, [customMessage]);

  return {
    /** True if network operations are disabled (offline or offline mode enabled) */
    isDisabled: !canUseNetwork,
    /** Shows an alert explaining the feature requires network */
    showOfflineMessage,
  };
}

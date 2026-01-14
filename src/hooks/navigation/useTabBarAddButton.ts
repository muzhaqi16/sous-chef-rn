import { useEffect, useRef, useCallback } from 'react';
import { useAppNavigation } from './useAppNavigation';
import { useTabBarActions } from '#/context/TabBarActionsContext';

/**
 * Register a handler for the tab bar add button when the screen is focused.
 * Automatically cleans up when unfocused or unmounted.
 *
 * @param handler - Function to call when add button is pressed
 * @param disabled - Whether the button should be disabled
 * @param disabledTooltip - Tooltip to show when button is disabled
 *
 * @example
 * ```tsx
 * // Simple usage
 * useTabBarAddButton(() => navigate('AddItem'));
 *
 * // With disabled state
 * useTabBarAddButton(
 *   () => handleAddItem(),
 *   !hasPermission,
 *   "You don't have permission to add items"
 * );
 * ```
 */
export const useTabBarAddButton = (
  handler: (() => void) | undefined,
  disabled?: boolean,
  disabledTooltip?: string,
) => {
  const { isFocused } = useAppNavigation();
  const { setAddProps } = useTabBarActions();
  const handlerRef = useRef(handler);

  // Keep ref up to date without triggering effect
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Create stable wrapper that always calls the latest handler
  const stableHandler = useCallback(() => {
    handlerRef.current?.();
  }, []);

  useEffect(() => {
    if (!isFocused || !handler) {
      setAddProps(undefined);
      return;
    }

    setAddProps(stableHandler, disabled, disabledTooltip);

    return () => {
      setAddProps(undefined);
    };
  }, [
    isFocused,
    handler,
    stableHandler,
    disabled,
    disabledTooltip,
    setAddProps,
  ]);
};

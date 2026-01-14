import { useEffect, useRef, useCallback } from 'react';
import { useAppNavigation } from './useAppNavigation';
import { useTabBarActions } from '#/context/TabBarActionsContext';

/**
 * Register a handler for the tab bar add button when the screen is focused.
 * Automatically cleans up when unfocused or unmounted.
 *
 * @param handler - Function to call when add button is pressed
 * @param disabled - Whether the button should be disabled (default: false)
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
  disabled: boolean = false,
  disabledTooltip?: string,
) => {
  const { isFocused } = useAppNavigation();
  const { setAddProps } = useTabBarActions();

  // Store handler in ref to avoid stale closures
  const handlerRef = useRef(handler);

  // Store disabled state in ref to avoid unnecessary re-registrations
  const disabledRef = useRef(disabled);
  const tooltipRef = useRef(disabledTooltip);

  // Keep refs up to date
  useEffect(() => {
    handlerRef.current = handler;
    disabledRef.current = disabled;
    tooltipRef.current = disabledTooltip;
  });

  // Create stable wrapper that always calls the latest handler
  const stableHandler = useCallback(() => {
    if (handlerRef.current) {
      handlerRef.current();
    }
  }, []);

  useEffect(() => {
    // Early return if screen is not focused or no handler provided
    if (!isFocused || !handler) {
      setAddProps(undefined);
      return;
    }

    // Register the handler with current disabled state and tooltip
    setAddProps(stableHandler, disabledRef.current, tooltipRef.current);

    // Cleanup: always unregister when effect re-runs or component unmounts
    return () => {
      setAddProps(undefined);
    };
  }, [isFocused, handler, stableHandler, setAddProps]);

  // Note: disabled and disabledTooltip are intentionally NOT in dependencies
  // They're accessed via refs to avoid unnecessary re-registrations
  // This prevents flickering when only disabled state changes
};

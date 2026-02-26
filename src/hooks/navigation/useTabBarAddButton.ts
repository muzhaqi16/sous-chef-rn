import { useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarSetters } from '#/context/TabBarActionsContext';

/**
 * Register a handler for the tab bar add button when the screen is focused.
 * Automatically cleans up when unfocused or unmounted.
 *
 * Uses useFocusEffect instead of useIsFocused to avoid breaking freezeOnBlur.
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
  const { setAddProps } = useTabBarSetters();

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

  useFocusEffect(useCallback(() => {
    if (!handlerRef.current) {
      setAddProps(undefined);
      return;
    }

    // Register on focus
    setAddProps(stableHandler, disabledRef.current, tooltipRef.current);

    // Unregister on blur
    return () => {
      setAddProps(undefined);
    };
  }, [stableHandler, setAddProps]));
};

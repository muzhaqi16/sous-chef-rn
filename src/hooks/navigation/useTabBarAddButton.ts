import { useEffect, useRef, useState } from 'react';
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
  const setAddPropsRef = useRef(setAddProps);

  // Store handler in ref to avoid stale closures
  const handlerRef = useRef(handler);

  // Store disabled state in ref to avoid unnecessary re-registrations
  const disabledRef = useRef(disabled);
  const tooltipRef = useRef(disabledTooltip);
  const isFocusedRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    handlerRef.current = handler;
    disabledRef.current = disabled;
    tooltipRef.current = disabledTooltip;
  }, [handler, disabled, disabledTooltip]);

  useEffect(() => {
    setAddPropsRef.current = setAddProps;
  }, [setAddProps]);

  // Create stable wrapper that always calls the latest handler
  const [stableHandler] = useState(() => () => {
    if (handlerRef.current) {
      handlerRef.current();
    }
  });

  const [onFocusEffect] = useState(() => () => {
    isFocusedRef.current = true;

    if (!handlerRef.current) {
      setAddPropsRef.current(undefined);
      return () => {
        isFocusedRef.current = false;
        setAddPropsRef.current(undefined);
      };
    }

    // Register on focus with a stable callback reference.
    setAddPropsRef.current(
      stableHandler,
      disabledRef.current,
      tooltipRef.current,
    );

    // Unregister on blur
    return () => {
      isFocusedRef.current = false;
      setAddPropsRef.current(undefined);
    };
  });
  useFocusEffect(onFocusEffect);

  const hasHandler = !!handler;

  // Keep disabled state and handler presence in sync while focused.
  // This avoids re-register loops from unstable inline handler references.
  useEffect(() => {
    if (!isFocusedRef.current) {
      return;
    }

    if (!hasHandler) {
      setAddPropsRef.current(undefined);
      return;
    }

    setAddPropsRef.current(stableHandler, disabledRef.current, tooltipRef.current);
  }, [hasHandler, disabled, disabledTooltip, stableHandler]);
};

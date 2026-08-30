import { useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarSetters } from '#/context/TabBarActionsContext';

/**
 * Registers the tab bar's add-button handler while the screen is focused, and
 * clears it on blur or unmount. `useFocusEffect`, not `useIsFocused`, so screen
 * pausing (`inactiveBehavior`) keeps working.
 */
export const useTabBarAddButton = (
  handler: (() => void) | undefined,
  disabled: boolean = false,
  disabledTooltip?: string,
) => {
  const { setAddProps } = useTabBarSetters();
  const setAddPropsRef = useRef(setAddProps);

  // Refs, so a changed handler or disabled state does not re-register.
  const handlerRef = useRef(handler);
  const disabledRef = useRef(disabled);
  const tooltipRef = useRef(disabledTooltip);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    handlerRef.current = handler;
    disabledRef.current = disabled;
    tooltipRef.current = disabledTooltip;
  }, [handler, disabled, disabledTooltip]);

  useEffect(() => {
    setAddPropsRef.current = setAddProps;
  }, [setAddProps]);

  // Stable identity, always calling the latest handler.
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

    setAddPropsRef.current(
      stableHandler,
      disabledRef.current,
      tooltipRef.current,
    );
  }, [hasHandler, disabled, disabledTooltip, stableHandler]);
};

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import type { IconLibrary } from '#/utils/iconUtils';

/**
 * TabBarActionsContext - Split into State and Setters contexts
 *
 * Manages the floating action buttons in the tab bar:
 * - Scanner button: Opens barcode scanner (Pantry, ShoppingList tabs)
 * - Add button: Opens add flow (Pantry, ShoppingList, Recipe tabs)
 *
 * Split into two contexts to prevent unnecessary re-renders:
 * - TabBarSettersContext: Stable setter functions (rarely changes)
 * - TabBarStateContext: Derived state (changes on tab switches, button presses)
 *
 * Most consumers only need setters and won't re-render on tab switches.
 */

interface AddButtonConfig {
  icon: string;
  iconLibrary: IconLibrary;
}

interface TabBarSettersContextType {
  setScannerProps: (onScanPress?: () => void, showButton?: boolean) => void;
  /**
   * Register add button handler for the current screen.
   * Button visibility is now automatic based on active tab - always shows on allowed tabs.
   * @param handler - callback when button is pressed
   * @param disabled - whether button should be disabled (shows toast instead)
   * @param disabledMessage - custom message when button is disabled
   */
  setAddProps: (
    handler?: () => void,
    disabled?: boolean,
    disabledMessage?: string,
  ) => void;
  setActiveTab: (tabName: string) => void;
  setOverlayOpen: (isOpen: boolean) => void;
}

interface TabBarStateContextType {
  // Scanner button props
  onScanPress?: () => void;
  showScannerButton: boolean;

  // Add button props
  onAddPress?: () => void;
  showAddButton: boolean;
  addButtonConfig: AddButtonConfig;
  isAddButtonDisabled: boolean;
  addButtonDisabledMessage?: string;

  // Shared state
  activeTab: string;
  isOverlayOpen: boolean;
}

// Combined type for backwards compatibility
type TabBarActionsContextType = TabBarSettersContextType &
  TabBarStateContextType;

const TabBarSettersContext = createContext<TabBarSettersContextType | undefined>(
  undefined,
);

const TabBarStateContext = createContext<TabBarStateContextType | undefined>(
  undefined,
);

interface TabBarActionsProviderProps {
  children: ReactNode;
}

export const TabBarActionsProvider: React.FC<TabBarActionsProviderProps> = ({
  children,
}) => {
  // Scanner state
  const [onScanPress, setOnScanPress] = useState<(() => void) | undefined>(
    undefined,
  );
  const [showScannerButton, setShowScannerButton] = useState(false);

  // Add button state - visibility is now automatic based on active tab
  const [onAddPress, setOnAddPress] = useState<(() => void) | undefined>(
    undefined,
  );
  const [isAddButtonDisabled, setIsAddButtonDisabled] = useState(false);
  const [addButtonDisabledMessage, setAddButtonDisabledMessage] = useState<
    string | undefined
  >(undefined);

  // Shared state
  const [activeTab, setActiveTab] = useState<string>('');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // Ref to track activeTab for use in callbacks without causing re-renders
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Define which tabs should show buttons
  const allowedScannerTabs = ['Pantry', 'ShoppingList'];
  // Add button shown on all main tabs to avoid layout shift/empty space
  const allowedAddTabs = ['Pantry', 'ShoppingList', 'Recipe', 'Profile'];

  // Store handlers per tab so we don't lose them during transitions
  // This prevents the add button from flickering when navigating between allowed tabs
  const [tabHandlers, setTabHandlers] = useState<Record<string, () => void>>(
    {},
  );

  const setScannerProps = useCallback(
    (scanPress?: () => void, showButton: boolean = false) => {
      // Only update if values have changed to prevent unnecessary re-renders
      setOnScanPress(prev => {
        // Compare function references - only update if different
        if (prev === scanPress) return prev;
        return scanPress || undefined;
      });
      setShowScannerButton(prev => {
        // Only update if showButton value has changed
        if (prev === showButton) return prev;
        return showButton;
      });
    },
    [],
  );

  const setAddProps = useCallback(
    (
      handler?: () => void,
      disabled: boolean = false,
      disabledMessage?: string,
    ) => {
      // Store handler by active tab to prevent flickering during tab transitions
      // When a screen registers its handler, we store it for that tab
      if (handler) {
        setTabHandlers(prev => {
          const currentTab = activeTabRef.current;
          if (currentTab && prev[currentTab] !== handler) {
            return { ...prev, [currentTab]: handler };
          }
          return prev;
        });
      }

      // Only update if values have changed to prevent unnecessary re-renders
      setOnAddPress(prev => {
        if (prev === handler) return prev;
        return handler || undefined;
      });
      setIsAddButtonDisabled(prev => {
        if (prev === disabled) return prev;
        return disabled;
      });
      setAddButtonDisabledMessage(prev => {
        if (prev === disabledMessage) return prev;
        return disabledMessage;
      });
    },
    [],
  );

  const setOverlayOpenCb = useCallback((isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  }, []);

  const handleSetActiveTab = useCallback((tabName: string) => {
    activeTabRef.current = tabName; // Sync update before state change to prevent race condition
    setActiveTab(tabName);
  }, []);

  // Memoize setters context - very stable, only changes if callbacks change (they don't)
  const settersValue = useMemo<TabBarSettersContextType>(
    () => ({
      setScannerProps,
      setAddProps,
      setActiveTab: handleSetActiveTab,
      setOverlayOpen: setOverlayOpenCb,
    }),
    [setScannerProps, setAddProps, handleSetActiveTab, setOverlayOpenCb],
  );

  // Only show buttons if the current tab is in the allowed list and button is enabled
  const shouldShowScanner =
    showScannerButton && allowedScannerTabs.includes(activeTab);

  // Add button: always show on allowed tabs (visibility is automatic)
  // This eliminates race conditions during tab transitions
  const shouldShowAdd = allowedAddTabs.includes(activeTab);

  // Use stored handler as fallback during transitions
  const effectiveAddPress =
    onAddPress || (activeTab ? tabHandlers[activeTab] : undefined);

  // Get icon configuration based on active tab
  const addButtonConfig = useMemo((): AddButtonConfig => {
    switch (activeTab) {
      case 'Recipe':
        return { icon: 'search', iconLibrary: 'Feather' };
      case 'Profile':
        return { icon: 'dots-horizontal', iconLibrary: 'MaterialDesignIcons' };
      default:
        // Pantry, ShoppingList use the default add icon
        return { icon: 'add', iconLibrary: 'MaterialIcons' };
    }
  }, [activeTab]);

  // Memoize state context - changes when tab/button state changes
  const stateValue = useMemo<TabBarStateContextType>(
    () => ({
      onScanPress,
      showScannerButton: shouldShowScanner,
      onAddPress: effectiveAddPress,
      showAddButton: shouldShowAdd,
      addButtonConfig,
      isAddButtonDisabled,
      addButtonDisabledMessage,
      activeTab,
      isOverlayOpen,
    }),
    [
      onScanPress,
      shouldShowScanner,
      effectiveAddPress,
      shouldShowAdd,
      addButtonConfig,
      isAddButtonDisabled,
      addButtonDisabledMessage,
      activeTab,
      isOverlayOpen,
    ],
  );

  return (
    <TabBarSettersContext.Provider value={settersValue}>
      <TabBarStateContext.Provider value={stateValue}>
        {children}
      </TabBarStateContext.Provider>
    </TabBarSettersContext.Provider>
  );
};

/**
 * Hook to access only tab bar setter functions.
 * Consumers using only setters won't re-render on tab switches or state changes.
 */
export const useTabBarSetters = (): TabBarSettersContextType => {
  const context = useContext(TabBarSettersContext);
  if (context === undefined) {
    throw new Error(
      'useTabBarSetters must be used within a TabBarActionsProvider',
    );
  }
  return context;
};

/**
 * Hook to access tab bar UI state (buttons, active tab, overlay).
 * Re-renders when any state changes.
 */
export const useTabBarState = (): TabBarStateContextType => {
  const context = useContext(TabBarStateContext);
  if (context === undefined) {
    throw new Error(
      'useTabBarState must be used within a TabBarActionsProvider',
    );
  }
  return context;
};

/**
 * Hook to access tab bar action buttons state and setters.
 * Backwards-compatible: combines both contexts.
 * Prefer useTabBarSetters or useTabBarState for better performance.
 */
export const useTabBarActions = (): TabBarActionsContextType => {
  const setters = useTabBarSetters();
  const state = useTabBarState();
  return { ...setters, ...state };
};

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
 * TabBarActionsContext
 *
 * Manages the floating action buttons in the tab bar:
 * - Scanner button: Opens barcode scanner (Pantry, ShoppingList tabs)
 * - Add button: Opens add flow (Pantry, ShoppingList, Recipe tabs)
 *
 * Also tracks active tab and overlay state for coordinating UI visibility.
 */

interface AddButtonConfig {
  icon: string;
  iconLibrary: IconLibrary;
}

interface TabBarActionsContextType {
  // Scanner button props
  onScanPress?: () => void;
  showScannerButton: boolean;
  setScannerProps: (onScanPress?: () => void, showButton?: boolean) => void;

  // Add button props
  onAddPress?: () => void;
  showAddButton: boolean;
  addButtonConfig: AddButtonConfig;
  isAddButtonDisabled: boolean;
  addButtonDisabledMessage?: string;
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

  // Shared state
  activeTab: string;
  setActiveTab: (tabName: string) => void;
  isOverlayOpen: boolean;
  setOverlayOpen: (isOpen: boolean) => void;
}

const TabBarActionsContext = createContext<
  TabBarActionsContextType | undefined
>(undefined);

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

  const setOverlayOpen = useCallback((isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  }, []);

  const handleSetActiveTab = useCallback((tabName: string) => {
    setActiveTab(tabName);
  }, []);

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

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      // Scanner props
      onScanPress,
      showScannerButton: shouldShowScanner,
      setScannerProps,
      // Add button props - use effectiveAddPress to maintain handler during transitions
      onAddPress: effectiveAddPress,
      showAddButton: shouldShowAdd,
      addButtonConfig,
      isAddButtonDisabled,
      addButtonDisabledMessage,
      setAddProps,
      // Shared
      activeTab,
      setActiveTab: handleSetActiveTab,
      isOverlayOpen,
      setOverlayOpen,
    }),
    [
      onScanPress,
      shouldShowScanner,
      setScannerProps,
      effectiveAddPress,
      shouldShowAdd,
      addButtonConfig,
      isAddButtonDisabled,
      addButtonDisabledMessage,
      setAddProps,
      activeTab,
      handleSetActiveTab,
      isOverlayOpen,
      setOverlayOpen,
    ],
  );

  return (
    <TabBarActionsContext.Provider value={contextValue}>
      {children}
    </TabBarActionsContext.Provider>
  );
};

/**
 * Hook to access tab bar action buttons state and setters
 */
export const useTabBarActions = (): TabBarActionsContextType => {
  const context = useContext(TabBarActionsContext);
  if (context === undefined) {
    throw new Error(
      'useTabBarActions must be used within a TabBarActionsProvider',
    );
  }
  return context;
};

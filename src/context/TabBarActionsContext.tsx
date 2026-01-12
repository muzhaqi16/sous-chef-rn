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
  setAddProps: (onAddPress?: () => void, showButton?: boolean) => void;

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

  // Add button state
  const [onAddPress, setOnAddPress] = useState<(() => void) | undefined>(
    undefined,
  );
  const [showAddButton, setShowAddButton] = useState(false);

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
    (addPress?: () => void, showButton: boolean = false) => {
      // Store handler by active tab to prevent flickering during tab transitions
      // When a screen registers its handler, we store it for that tab
      // When a screen unregisters (cleanup), we only clear if we're leaving allowed tabs
      if (addPress) {
        setTabHandlers(prev => {
          const currentTab = activeTabRef.current;
          if (currentTab && prev[currentTab] !== addPress) {
            return { ...prev, [currentTab]: addPress };
          }
          return prev;
        });
      }

      // Only update if values have changed to prevent unnecessary re-renders
      setOnAddPress(prev => {
        if (prev === addPress) return prev;
        return addPress || undefined;
      });
      setShowAddButton(prev => {
        if (prev === showButton) return prev;
        return showButton;
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

  // For add button: show if we're on an allowed tab AND either:
  // 1. showAddButton is true (screen has registered), OR
  // 2. We have a stored handler for this tab (prevents flicker during transitions)
  const hasStoredHandler = Boolean(activeTab && tabHandlers[activeTab]);
  const shouldShowAdd =
    allowedAddTabs.includes(activeTab) && (showAddButton || hasStoredHandler);

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

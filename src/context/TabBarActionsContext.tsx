import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { IconLibrary } from '#/utils/iconUtils';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

/**
 * The tab bar's floating scanner and add buttons, split into a stable setters
 * context and a derived state context — most consumers need only the setters and
 * so do not re-render on a tab switch.
 */

interface AddButtonConfig {
  icon: string;
  iconLibrary: IconLibrary;
}

interface TabBarSettersContextType {
  setScannerProps: (onScanPress?: () => void, showButton?: boolean) => void;
  /** Registers the current screen's add handler; visibility follows the active tab. */
  setAddProps: (
    handler?: () => void,
    disabled?: boolean,
    disabledMessage?: string,
  ) => void;
  setActiveTab: (tabName: string) => void;
  setOverlayOpen: (isOpen: boolean) => void;
  setAddButtonRect: (rect: TargetRect) => void;
  /** Written from screens' scroll worklets on the UI thread; no JS re-renders. */
  scrollTabBarHidden: SharedValue<boolean>;
}

interface TabBarStateContextType {
  onScanPress?: () => void;
  showScannerButton: boolean;

  onAddPress?: () => void;
  showAddButton: boolean;
  addButtonConfig: AddButtonConfig;
  isAddButtonDisabled: boolean;
  addButtonDisabledMessage?: string;

  activeTab: string;
  isOverlayOpen: boolean;
  addButtonRect: TargetRect | null;
}

type TabBarActionsContextType = TabBarSettersContextType &
  TabBarStateContextType;

const TabBarSettersContext = createContext<
  TabBarSettersContextType | undefined
>(undefined);

const TabBarStateContext = createContext<TabBarStateContextType | undefined>(
  undefined,
);

interface TabBarActionsProviderProps {
  children: ReactNode;
}

export const TabBarActionsProvider: React.FC<TabBarActionsProviderProps> = ({
  children,
}) => {
  const [onScanPress, setOnScanPress] = useState<(() => void) | undefined>(
    undefined,
  );
  const [showScannerButton, setShowScannerButton] = useState(false);

  const [onAddPress, setOnAddPress] = useState<(() => void) | undefined>(
    undefined,
  );
  const [isAddButtonDisabled, setIsAddButtonDisabled] = useState(false);
  const [addButtonDisabledMessage, setAddButtonDisabledMessage] = useState<
    string | undefined
  >(undefined);

  const [activeTab, setActiveTab] = useState<string>('');
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [addButtonRect, setAddButtonRect] = useState<TargetRect | null>(null);

  const scrollTabBarHidden = useSharedValue(false);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const allowedScannerTabs = ['Pantry', 'ShoppingList'];
  // Shown on every main tab so switching tabs causes no layout shift.
  const allowedAddTabs = ['Pantry', 'ShoppingList', 'Recipe', 'MealPlan'];

  // Per-tab so a transition doesn't lose the handler and flicker the button.
  const [tabHandlers, setTabHandlers] = useState<Record<string, () => void>>(
    {},
  );

  const setScannerProps = (
    scanPress?: () => void,
    showButton: boolean = false,
  ) => {
    setOnScanPress(prev => {
      if (prev === scanPress) return prev;
      return scanPress || undefined;
    });
    setShowScannerButton(prev => {
      if (prev === showButton) return prev;
      return showButton;
    });
  };

  const setAddProps = (
    handler?: () => void,
    disabled: boolean = false,
    disabledMessage?: string,
  ) => {
    if (handler) {
      setTabHandlers(prev => {
        const currentTab = activeTabRef.current;
        if (currentTab && prev[currentTab] !== handler) {
          return { ...prev, [currentTab]: handler };
        }
        return prev;
      });
    }

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
  };

  const setOverlayOpenCb = (isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  };

  const handleSetActiveTab = (tabName: string) => {
    activeTabRef.current = tabName; // Sync update before state change to prevent race condition
    setActiveTab(tabName);
  };

  const settersValue: TabBarSettersContextType = {
    setScannerProps,
    setAddProps,
    setActiveTab: handleSetActiveTab,
    setOverlayOpen: setOverlayOpenCb,
    setAddButtonRect,
    scrollTabBarHidden,
  };

  const shouldShowScanner =
    showScannerButton && allowedScannerTabs.includes(activeTab);

  // Always shown on an allowed tab, which removes the tab-transition race.
  const shouldShowAdd = allowedAddTabs.includes(activeTab);

  const effectiveAddPress =
    onAddPress || (activeTab ? tabHandlers[activeTab] : undefined);

  const addButtonConfig: AddButtonConfig = {
    icon: 'add',
    iconLibrary: 'Ionicons',
  };

  const stateValue: TabBarStateContextType = {
    onScanPress,
    showScannerButton: shouldShowScanner,
    onAddPress: effectiveAddPress,
    showAddButton: shouldShowAdd,
    addButtonConfig,
    isAddButtonDisabled,
    addButtonDisabledMessage,
    activeTab,
    isOverlayOpen,
    addButtonRect,
  };

  return (
    <TabBarSettersContext.Provider value={settersValue}>
      <TabBarStateContext.Provider value={stateValue}>
        {children}
      </TabBarStateContext.Provider>
    </TabBarSettersContext.Provider>
  );
};

export const useTabBarSetters = (): TabBarSettersContextType => {
  const context = useContext(TabBarSettersContext);
  if (context === undefined) {
    throw new Error(
      'useTabBarSetters must be used within a TabBarActionsProvider',
    );
  }
  return context;
};

export const useTabBarState = (): TabBarStateContextType => {
  const context = useContext(TabBarStateContext);
  if (context === undefined) {
    throw new Error(
      'useTabBarState must be used within a TabBarActionsProvider',
    );
  }
  return context;
};

/** Prefer `useTabBarSetters` or `useTabBarState` — this subscribes to both. */
export const useTabBarActions = (): TabBarActionsContextType => {
  const setters = useTabBarSetters();
  const state = useTabBarState();
  return { ...setters, ...state };
};

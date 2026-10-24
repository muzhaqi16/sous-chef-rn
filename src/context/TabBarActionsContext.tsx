import type { ReactNode } from 'react';
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { IconLibrary } from '#components/atoms/Icon';
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

/** One entry of a tab's add menu. */
export interface TabBarAddAction {
  /** Unique within the menu. */
  key: string;
  label: string;
  icon: string;
  iconLibrary?: IconLibrary;
  onPress: () => void;
  /** Set while the action cannot run: the entry is disabled and shows it. */
  disabledReason?: string;
  /**
   * The action waits on data still loading rather than on a refusal, so an add
   * handed over from another tab waits for it instead of showing the reason.
   */
  pending?: boolean;
  testID?: string;
}

interface TabBarSettersContextType {
  setScannerProps: (onScanPress?: () => void, showButton?: boolean) => void;
  setActiveTab: (tabName: string) => void;
  setOverlayOpen: (isOpen: boolean) => void;
  setAddButtonRect: (rect: TargetRect) => void;
  /** A tab's add menu; undefined removes it. Kept per tab, so it survives blur. */
  setAddMenu: (
    tab: string,
    actions: readonly TabBarAddAction[] | undefined,
  ) => void;
  setAddMenuOpen: (open: boolean) => void;
  /** Written from screens' scroll worklets on the UI thread; no JS re-renders. */
  scrollTabBarHidden: SharedValue<boolean>;
}

interface TabBarStateContextType {
  onScanPress?: () => void;
  showScannerButton: boolean;

  showAddButton: boolean;
  addButtonConfig: AddButtonConfig;

  /** The active tab's add menu; with two or more entries the `+` opens it. */
  addMenu?: readonly TabBarAddAction[];
  isAddMenuOpen: boolean;

  activeTab: string;
  isOverlayOpen: boolean;
  addButtonRect: TargetRect | null;
}

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
  const allowedAddTabs = [
    'Today',
    'Pantry',
    'ShoppingList',
    'Recipe',
    'MealPlan',
  ];

  const [tabMenus, setTabMenus] = useState<
    Partial<Record<string, readonly TabBarAddAction[]>>
  >({});
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const setScannerProps = (
    scanPress?: () => void,
    showButton: boolean = false,
  ) => {
    setOnScanPress(prev => {
      if (prev === scanPress) return prev;
      return scanPress;
    });
    setShowScannerButton(prev => {
      if (prev === showButton) return prev;
      return showButton;
    });
  };

  const setOverlayOpenCb = (isOpen: boolean) => {
    setIsOverlayOpen(isOpen);
  };

  const setAddMenu = (
    tab: string,
    actions: readonly TabBarAddAction[] | undefined,
  ) => {
    setTabMenus(prev => {
      if (prev[tab] === actions) return prev;
      const next = { ...prev };
      if (actions) next[tab] = actions;
      else delete next[tab];
      return next;
    });
  };

  const handleSetActiveTab = (tabName: string) => {
    activeTabRef.current = tabName; // Sync update before state change to prevent race condition
    setActiveTab(tabName);
    // An open menu belongs to the tab being left.
    setIsAddMenuOpen(false);
  };

  const settersValue: TabBarSettersContextType = {
    setScannerProps,
    setActiveTab: handleSetActiveTab,
    setOverlayOpen: setOverlayOpenCb,
    setAddButtonRect,
    setAddMenu,
    setAddMenuOpen: setIsAddMenuOpen,
    scrollTabBarHidden,
  };

  const shouldShowScanner =
    showScannerButton && allowedScannerTabs.includes(activeTab);

  // Always shown on an allowed tab, which removes the tab-transition race.
  const shouldShowAdd = allowedAddTabs.includes(activeTab);

  const addButtonConfig: AddButtonConfig = {
    icon: 'add',
    iconLibrary: 'Ionicons',
  };

  const stateValue: TabBarStateContextType = {
    onScanPress,
    showScannerButton: shouldShowScanner,
    showAddButton: shouldShowAdd,
    addButtonConfig,
    addMenu: activeTab ? tabMenus[activeTab] : undefined,
    isAddMenuOpen,
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

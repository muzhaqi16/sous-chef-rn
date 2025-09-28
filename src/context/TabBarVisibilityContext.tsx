import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { useStore } from '#/store';

interface TabBarVisibilityContextType {
  isVisible: SharedValue<boolean>;
  hideTabBar: (reason: string) => void;
  showTabBar: (reason: string) => void;
  updateScrollVisibility: (contentOffsetY: number, prevOffsetY: number) => void;
}

const TabBarVisibilityContext =
  createContext<TabBarVisibilityContextType | null>(null);

interface TabBarVisibilityProviderProps {
  children: ReactNode;
}

export const TabBarVisibilityProvider: React.FC<
  TabBarVisibilityProviderProps
> = ({ children }) => {
  const isVisible = useSharedValue(true);
  const lastScrollY = React.useRef(0);
  const mountTime = React.useRef(Date.now());

  // Get store methods
  const hideTabBarStore = useStore(state => state.hideTabBar);
  const showTabBarStore = useStore(state => state.showTabBar);

  // Subscribe to store changes and update shared value
  useEffect(() => {
    const unsubscribe = useStore.subscribe(
      state => state.isTabBarVisible,
      isTabBarVisible => {
        isVisible.value = isTabBarVisible;
      },
    );

    // Set initial value
    isVisible.value = useStore.getState().isTabBarVisible;

    return unsubscribe;
  }, [isVisible]);


  // Scroll-based visibility logic - pure JavaScript
  const updateScrollVisibility = useMemo(() => {
    return (contentOffsetY: number, prevOffsetY: number) => {
      // Prevent immediate hiding during first 1000ms after mount
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount < 1000) {
        return;
      }

      const currentY = Math.max(contentOffsetY, 0);
      const previousY = Math.max(prevOffsetY, 0);

      // Calculate scroll direction
      const isScrollingUp = previousY >= currentY;

      // Only hide if scrolled down more than 10 pixels to avoid jitter
      const significantScroll = Math.abs(currentY - previousY) > 10;

      // Show when scrolling up or at the top
      // Hide when scrolling down significantly
      if (significantScroll) {
        const shouldScrollBeVisible = isScrollingUp || currentY <= 50;

        // Call store methods directly from JavaScript
        if (shouldScrollBeVisible) {
          showTabBarStore('scroll');
        } else {
          hideTabBarStore('scroll');
        }
      }

      lastScrollY.current = currentY;
    };
  }, [hideTabBarStore, showTabBarStore]);

  // Simple wrapper methods
  const hideTabBar = useMemo(() => {
    return (reason: string) => {
      hideTabBarStore(reason);
    };
  }, [hideTabBarStore]);

  const showTabBar = useMemo(() => {
    return (reason: string) => {
      showTabBarStore(reason);
    };
  }, [showTabBarStore]);

  const contextValue = useMemo(
    () => ({
      isVisible,
      hideTabBar,
      showTabBar,
      updateScrollVisibility,
    }),
    [isVisible, hideTabBar, showTabBar, updateScrollVisibility],
  );

  return (
    <TabBarVisibilityContext.Provider value={contextValue}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = (): TabBarVisibilityContextType => {
  const context = useContext(TabBarVisibilityContext);

  // Fallback for screens that don't use TabBarVisibilityProvider
  const fallbackIsVisible = useSharedValue(true);
  const fallbackHideTabBar = useMemo(() => {
    return () => {
      // No-op for screens without provider
    };
  }, []);
  const fallbackShowTabBar = useMemo(() => {
    return () => {
      // No-op for screens without provider
    };
  }, []);
  const fallbackUpdateScrollVisibility = useMemo(() => {
    return () => {
      'worklet';
      // No-op for screens without provider
    };
  }, []);

  if (!context) {
    return {
      isVisible: fallbackIsVisible,
      hideTabBar: fallbackHideTabBar,
      showTabBar: fallbackShowTabBar,
      updateScrollVisibility: fallbackUpdateScrollVisibility,
    };
  }

  return context;
};

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { storage } from '#/storage/mmkv';
import { useShowTutorials } from '#hooks/settings/useSettings';
import { useUserId } from '#store/useAppStore';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';

// ── Storage key helpers (compatible with useFeatureHint / resetAllFeatureHints) ──

const HINT_PREFIX = 'feature_hint_shown_';
const FEATURE_ID = 'shopping_interactive_tutorial';

const OLD_TUTORIAL_IDS = [
  'shopping_tutorial_selector',
  'shopping_tutorial_tabs',
  'shopping_tutorial_add',
];

function buildStorageKey(userId: string | undefined, featureId: string) {
  return userId
    ? `${HINT_PREFIX}${userId}_${featureId}`
    : `${HINT_PREFIX}${featureId}`;
}

// Completed if the interactive tutorial's flag (or an old static-tutorial flag)
// is set in MMKV. Read both on mount and on a reset signal so
// resetAllFeatureHints (Settings → "Reset to Defaults") clears the flags and
// the tutorial replays.
function readCompletedFromStorage(userId: string | undefined): boolean {
  if (storage.getBoolean(buildStorageKey(userId, FEATURE_ID))) return true;
  for (const oldId of OLD_TUTORIAL_IDS) {
    if (storage.getBoolean(buildStorageKey(userId, oldId))) return true;
  }
  return false;
}

// ── Public types ──

export enum ShoppingListTutorialStep {
  IDLE = 'IDLE',
  SPOTLIGHT_ADD_BUTTON = 'SPOTLIGHT_ADD_BUTTON',
  GUIDE_ADD_ITEM = 'GUIDE_ADD_ITEM',
  HINT_DISMISS_SHEET = 'HINT_DISMISS_SHEET',
  SPOTLIGHT_SWIPE_ACTIONS = 'SPOTLIGHT_SWIPE_ACTIONS',
  SPOTLIGHT_CHECKBOX = 'SPOTLIGHT_CHECKBOX',
  SPOTLIGHT_LONG_PRESS_PRICE = 'SPOTLIGHT_LONG_PRESS_PRICE',
  SPOTLIGHT_PURCHASED_TAB = 'SPOTLIGHT_PURCHASED_TAB',
  SPOTLIGHT_MOVE_TO_PANTRY = 'SPOTLIGHT_MOVE_TO_PANTRY',
  COMPLETED = 'COMPLETED',
}

export type TutorialRectKey =
  | 'addButton'
  | 'itemCard'
  | 'checkbox'
  | 'purchasedTab'
  | 'archiveIcon';

export const TUTORIAL_TOTAL_STEPS = 8;

export const TUTORIAL_STEP_CONFIG: Record<
  string,
  {
    /** i18n key paths — this table is module-level, no hook. */
    titleKey: string;
    subtitleKey: string;
    rectKey: TutorialRectKey;
    stepIndex: number;
  }
> = {
  [ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON]: {
    titleKey: 'shoppingListTutorial.addButton.title',
    subtitleKey: 'shoppingListTutorial.addButton.subtitle',
    rectKey: 'addButton',
    stepIndex: 0,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS]: {
    titleKey: 'shoppingListTutorial.swipeActions.title',
    subtitleKey: 'shoppingListTutorial.swipeActions.subtitle',
    rectKey: 'itemCard',
    stepIndex: 3,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX]: {
    titleKey: 'shoppingListTutorial.checkbox.title',
    subtitleKey: 'shoppingListTutorial.checkbox.subtitle',
    rectKey: 'checkbox',
    stepIndex: 4,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE]: {
    titleKey: 'shoppingListTutorial.longPress.title',
    subtitleKey: 'shoppingListTutorial.longPress.subtitle',
    rectKey: 'itemCard',
    stepIndex: 5,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB]: {
    titleKey: 'shoppingListTutorial.purchasedTab.title',
    subtitleKey: 'shoppingListTutorial.purchasedTab.subtitle',
    rectKey: 'purchasedTab',
    stepIndex: 6,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY]: {
    titleKey: 'shoppingListTutorial.moveToPantry.title',
    subtitleKey: 'shoppingListTutorial.moveToPantry.subtitle',
    rectKey: 'archiveIcon',
    stepIndex: 7,
  },
};

// ── Context ──
//
// Split into State + Actions contexts (TabBarActionsContext / OnboardingContext
// pattern). Components that only read state (e.g. SortableItem checking
// currentStep) won't re-render when an action callback is recreated, and
// components that only call actions (e.g. ShoppingListModalsContext) won't
// re-render when state changes.

interface ShoppingListTutorialStateContextValue {
  currentStep: ShoppingListTutorialStep;
  isActive: boolean;
  rects: Record<string, TargetRect | null>;
}

interface ShoppingListTutorialActionsContextValue {
  // Event dispatchers (called by child components when the user completes an action)
  notifyAddButtonPressed: () => void;
  notifyItemAdded: () => void;
  notifySheetClosed: () => void;
  notifySwipeActionsSeen: () => void;
  notifyCheckboxTapped: () => void;
  notifyLongPressPriceSeen: () => void;
  notifyPurchasedTabTapped: () => void;
  notifyMoveToPantryTapped: () => void;

  // Element position registration for SpotlightCoachMark
  registerRect: (key: TutorialRectKey, rect: TargetRect | null) => void;

  // Skip current spotlight step and advance to the next one
  skipCurrentStep: () => void;
  // Dismiss entire tutorial
  skipAll: () => void;
}

// Combined type for the backwards-compatible hook.
type ShoppingListTutorialContextValue = ShoppingListTutorialStateContextValue &
  ShoppingListTutorialActionsContextValue;

const ShoppingListTutorialStateContext =
  createContext<ShoppingListTutorialStateContextValue | null>(null);
const ShoppingListTutorialActionsContext =
  createContext<ShoppingListTutorialActionsContextValue | null>(null);

/**
 * Hook to access tutorial state (currentStep, isActive, rects).
 * Re-renders when state changes. Prefer this over useShoppingListTutorial
 * for components that only read state.
 */
export function useShoppingListTutorialState() {
  return useContext(ShoppingListTutorialStateContext);
}

/**
 * Hook to access tutorial actions (notify*, registerRect, skip*).
 * Stable across state changes — components that only fire events
 * won't re-render on state transitions.
 */
export function useShoppingListTutorialActions() {
  return useContext(ShoppingListTutorialActionsContext);
}

/**
 * Combined hook — backwards compatible. Prefer useShoppingListTutorialState
 * or useShoppingListTutorialActions for better performance.
 * Returns null when used outside the provider (safe for components shared across screens).
 */
export function useShoppingListTutorial(): ShoppingListTutorialContextValue | null {
  const state = useContext(ShoppingListTutorialStateContext);
  const actions = useContext(ShoppingListTutorialActionsContext);
  if (!state || !actions) return null;
  return { ...state, ...actions };
}

// ── Provider ──

interface ShoppingListTutorialProviderProps {
  children: ReactNode;
  /** Whether preconditions are met (e.g. lists.length > 0) */
  canStart: boolean;
}

export function ShoppingListTutorialProvider({
  children,
  canStart,
}: ShoppingListTutorialProviderProps) {
  const userId = useUserId();
  const tutorialsEnabled = useShowTutorials();

  // Check if tutorial (or old tutorial) was already completed — once, on mount
  const [isCompleted, setIsCompleted] = useState(() =>
    readCompletedFromStorage(userId),
  );

  const [currentStep, setCurrentStep] = useState(ShoppingListTutorialStep.IDLE);
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [rects, setRects] = useState<Record<string, TargetRect | null>>({});

  // Track the in-flight transition timer so it can be cleared on unmount
  // (advanceTo schedules a setTimeout to clear isTransitioning after 800ms).
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);

  // React to external resets (centralized signal hook). Re-derive completion
  // from MMKV rather than forcing it false, since resetAllFeatureHints is the
  // only path that clears the flags (→ replay).
  const wasReset = useTutorialResetSignal();
  if (wasReset) {
    setIsCompleted(readCompletedFromStorage(userId));
    setCurrentStep(ShoppingListTutorialStep.IDLE);
    setHasStarted(false);
    setIsTransitioning(false);
  }

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Startup delay (2 s, same as old tutorial)
  useEffect(() => {
    if (!canStart || isCompleted || hasStarted || !tutorialsEnabled) return;

    const timer = setTimeout(() => {
      setHasStarted(true);
      setCurrentStep(ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON);
    }, 2000);
    return () => clearTimeout(timer);
  }, [canStart, isCompleted, hasStarted, tutorialsEnabled]);

  // Mark old feature IDs as shown once the new tutorial starts
  useEffect(() => {
    if (!hasStarted) return;
    for (const oldId of OLD_TUTORIAL_IDS) {
      storage.set(buildStorageKey(userIdRef.current, oldId), true);
    }
  }, [hasStarted]);

  // ── Helpers ──

  const advanceTo = (nextStep: ShoppingListTutorialStep) => {
    setIsTransitioning(true);
    setCurrentStep(nextStep);
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      setIsTransitioning(false);
    }, 800);
  };

  const markComplete = () => {
    // Scoped to this tutorial only — the "Show Tutorials" setting (which
    // gates every screen's tutorial via tutorialsEnabled) is a separate,
    // user-controlled flag and must not be flipped as a side effect of
    // finishing one screen's guided tour.
    storage.set(buildStorageKey(userIdRef.current, FEATURE_ID), true);
    // Also mark the standalone swipe hint as shown so it never fires independently
    storage.set(
      buildStorageKey(userIdRef.current, 'shopping_list_swipe'),
      true,
    );
    setIsCompleted(true);
    setCurrentStep(ShoppingListTutorialStep.COMPLETED);
  };

  // ── Event dispatchers ──

  const notifyAddButtonPressed = () => {
    if (currentStep !== ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON) return;
    advanceTo(ShoppingListTutorialStep.GUIDE_ADD_ITEM);
  };

  const notifyItemAdded = () => {
    if (currentStep !== ShoppingListTutorialStep.GUIDE_ADD_ITEM) return;
    advanceTo(ShoppingListTutorialStep.HINT_DISMISS_SHEET);
  };

  const notifySheetClosed = () => {
    if (currentStep === ShoppingListTutorialStep.HINT_DISMISS_SHEET) {
      advanceTo(ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS);
    } else if (currentStep === ShoppingListTutorialStep.GUIDE_ADD_ITEM) {
      // User dismissed sheet without adding — go back to spotlight add button
      advanceTo(ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON);
    }
  };

  const notifySwipeActionsSeen = () => {
    if (currentStep !== ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS)
      return;
    advanceTo(ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX);
  };

  const notifyCheckboxTapped = () => {
    if (currentStep !== ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX) return;
    advanceTo(ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE);
  };

  const notifyLongPressPriceSeen = () => {
    if (currentStep !== ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE)
      return;
    advanceTo(ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB);
  };

  const notifyPurchasedTabTapped = () => {
    if (currentStep !== ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB)
      return;
    advanceTo(ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY);
  };

  const notifyMoveToPantryTapped = () => {
    if (currentStep !== ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY)
      return;
    markComplete();
  };

  // ── Rect registration ──

  const registerRect = (key: TutorialRectKey, rect: TargetRect | null) => {
    setRects(prev => {
      const existing = prev[key];
      if (existing === rect) return prev;
      if (
        existing &&
        rect &&
        existing.x === rect.x &&
        existing.y === rect.y &&
        existing.width === rect.width &&
        existing.height === rect.height
      )
        return prev;
      return { ...prev, [key]: rect };
    });
  };

  // ── Skip ──

  const skipCurrentStep = () => {
    const nextSpotlight: Partial<
      Record<ShoppingListTutorialStep, ShoppingListTutorialStep>
    > = {
      [ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON]:
        ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS,
      [ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS]:
        ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX,
      [ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX]:
        ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE,
      [ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE]:
        ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB,
      [ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB]:
        ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY,
    };
    const next = nextSpotlight[currentStep];
    if (next) {
      advanceTo(next);
    } else {
      markComplete();
    }
  };

  const skipAll = () => {
    markComplete();
    for (const oldId of OLD_TUTORIAL_IDS) {
      storage.set(buildStorageKey(userIdRef.current, oldId), true);
    }
  };

  const isActive =
    hasStarted &&
    !isCompleted &&
    !isTransitioning &&
    currentStep !== ShoppingListTutorialStep.IDLE &&
    currentStep !== ShoppingListTutorialStep.COMPLETED;

  const stateValue: ShoppingListTutorialStateContextValue = {
    currentStep,
    isActive,
    rects,
  };

  const actionsValue: ShoppingListTutorialActionsContextValue = {
    notifyAddButtonPressed,
    notifyItemAdded,
    notifySheetClosed,
    notifySwipeActionsSeen,
    notifyCheckboxTapped,
    notifyLongPressPriceSeen,
    notifyPurchasedTabTapped,
    notifyMoveToPantryTapped,
    registerRect,
    skipCurrentStep,
    skipAll,
  };

  return (
    <ShoppingListTutorialActionsContext.Provider value={actionsValue}>
      <ShoppingListTutorialStateContext.Provider value={stateValue}>
        {children}
      </ShoppingListTutorialStateContext.Provider>
    </ShoppingListTutorialActionsContext.Provider>
  );
}

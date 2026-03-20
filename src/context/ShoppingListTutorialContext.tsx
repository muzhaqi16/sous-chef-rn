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
import { useAppStore } from '#store/useAppStore';
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

// ── Public types ──

export enum ShoppingListTutorialStep {
  IDLE = 'IDLE',
  SPOTLIGHT_ADD_BUTTON = 'SPOTLIGHT_ADD_BUTTON',
  GUIDE_ADD_ITEM = 'GUIDE_ADD_ITEM',
  HINT_DISMISS_SHEET = 'HINT_DISMISS_SHEET',
  SPOTLIGHT_SWIPE_ACTIONS = 'SPOTLIGHT_SWIPE_ACTIONS',
  SPOTLIGHT_CHECKBOX = 'SPOTLIGHT_CHECKBOX',
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

export const TUTORIAL_TOTAL_STEPS = 7;

export const TUTORIAL_STEP_CONFIG: Record<
  string,
  {
    title: string;
    subtitle: string;
    rectKey: TutorialRectKey;
    stepIndex: number;
  }
> = {
  [ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON]: {
    title: 'Add an item',
    subtitle: 'Tap + to add items to your shopping list',
    rectKey: 'addButton',
    stepIndex: 0,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS]: {
    title: 'Swipe to manage items',
    subtitle: 'Swipe any item left to edit, or right to delete',
    rectKey: 'itemCard',
    stepIndex: 3,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX]: {
    title: 'Mark as purchased',
    subtitle: 'Tap the checkbox to mark this item as purchased',
    rectKey: 'checkbox',
    stepIndex: 4,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB]: {
    title: 'View purchased items',
    subtitle: 'Tap to see your purchased items',
    rectKey: 'purchasedTab',
    stepIndex: 5,
  },
  [ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY]: {
    title: 'Move to pantry',
    subtitle: 'Tap to move this item to your pantry',
    rectKey: 'archiveIcon',
    stepIndex: 6,
  },
};

// ── Context ──

interface ShoppingListTutorialContextValue {
  currentStep: ShoppingListTutorialStep;
  isActive: boolean;

  // Event dispatchers (called by child components when the user completes an action)
  notifyAddButtonPressed: () => void;
  notifyItemAdded: () => void;
  notifySheetClosed: () => void;
  notifySwipeActionsSeen: () => void;
  notifyCheckboxTapped: () => void;
  notifyPurchasedTabTapped: () => void;
  notifyMoveToPantryTapped: () => void;

  // Element position registration for SpotlightCoachMark
  registerRect: (key: TutorialRectKey, rect: TargetRect | null) => void;
  rects: Record<string, TargetRect | null>;

  // Dismiss entire tutorial
  skipAll: () => void;
}

const ShoppingListTutorialContext =
  createContext<ShoppingListTutorialContextValue | null>(null);

/**
 * Hook to access the interactive shopping list tutorial.
 * Returns null when used outside the provider (safe for components shared across screens).
 */
export function useShoppingListTutorial() {
  return useContext(ShoppingListTutorialContext);
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
  const userId = useAppStore(state => state.user?.id);
  const tutorialsEnabled = useShowTutorials();

  // Check if tutorial (or old tutorial) was already completed — once, on mount
  const [isCompleted, setIsCompleted] = useState(() => {
    const key = buildStorageKey(userId, FEATURE_ID);
    if (storage.getBoolean(key)) return true;
    // Skip for users who already saw the old static tutorial
    for (const oldId of OLD_TUTORIAL_IDS) {
      if (storage.getBoolean(buildStorageKey(userId, oldId))) return true;
    }
    return false;
  });

  const [currentStep, setCurrentStep] = useState(ShoppingListTutorialStep.IDLE);
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [rects, setRects] = useState<Record<string, TargetRect | null>>({});

  // React to external resets (centralized signal hook)
  const wasReset = useTutorialResetSignal();
  if (wasReset) {
    setIsCompleted(false);
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
    setTimeout(() => setIsTransitioning(false), 800);
  };

  const markComplete = () => {
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

  const value: ShoppingListTutorialContextValue = {
    currentStep,
    isActive,
    notifyAddButtonPressed,
    notifyItemAdded,
    notifySheetClosed,
    notifySwipeActionsSeen,
    notifyCheckboxTapped,
    notifyPurchasedTabTapped,
    notifyMoveToPantryTapped,
    registerRect,
    rects,
    skipAll,
  };

  return (
    <ShoppingListTutorialContext.Provider value={value}>
      {children}
    </ShoppingListTutorialContext.Provider>
  );
}

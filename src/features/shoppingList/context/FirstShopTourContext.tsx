import React, {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  type ReactNode,
} from 'react';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { onTutorialEvent } from '#domain/tutorialEvents';
import { useFirstShopTour, type FirstShopTarget } from './useFirstShopTour';

type FirstShopTour = ReturnType<typeof useFirstShopTour>;

/** What a row needs: which of its parts a tip waits on, and where to report. */
interface FirstShopRowTargets {
  wanted: FirstShopTour['wanted'];
  registerRect: (key: FirstShopTarget, rect: TargetRect | null) => void;
}

const FirstShopTourContext = createContext<FirstShopTour | null>(null);
// Apart, so the rows re-render only when what they report changes.
const FirstShopRowContext = createContext<FirstShopRowTargets | null>(null);

/** The List's tips, for the screen, its rows, tabs and add sheet. */
export function FirstShopTourProvider({
  children,
  ...input
}: Parameters<typeof useFirstShopTour>[0] & { children: ReactNode }) {
  const tour = useFirstShopTour(input);
  const { swipeTip } = tour;
  const rows: FirstShopRowTargets = {
    wanted: tour.wanted,
    registerRect: tour.registerRect,
  };
  // A row swiped open, while the swipe tip shows, is the tip done.
  const onRowSwiped = useEffectEvent(() => {
    if (swipeTip.currentStep) swipeTip.advanceInPlace();
  });
  useEffect(
    () =>
      onTutorialEvent(event => {
        if (event === 'list.rowSwiped') onRowSwiped();
      }),
    [],
  );
  return (
    <FirstShopTourContext.Provider value={tour}>
      <FirstShopRowContext.Provider value={rows}>
        {children}
      </FirstShopRowContext.Provider>
    </FirstShopTourContext.Provider>
  );
}

/** Null outside the List, so a component shared with other screens can call it. */
export function useFirstShopTourContext(): FirstShopTour | null {
  return useContext(FirstShopTourContext);
}

/** A row's part of the tour; null outside the List. */
export function useFirstShopRowTargets(): FirstShopRowTargets | null {
  return useContext(FirstShopRowContext);
}

import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useUserId } from '#store/useAppStore';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useTutorialSequence } from '#hooks/ui/useTutorialSequence';
import { hasFeatureHintBeenShown } from '#hooks/settings/useFeatureHint';
import { useTutorialSession } from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';

/** What the list's tips point at. */
export type FirstShopTarget =
  | 'addButton'
  | 'checkbox'
  | 'archiveIcon'
  | 'itemCard';

/** The guide's step ids, for the screen to act on the step it shows. */
export const FIRST_SHOP_STEP = {
  add: 'first_shop_add',
  pick: 'first_shop_pick',
  check: 'first_shop_check',
  putAway: 'first_shop_pantry',
};

// Ids of the List's earlier tutorial: an account that finished it is not
// walked through the list again.
const EARLIER_TUTORIAL = [
  'shopping_interactive_tutorial',
  'shopping_tutorial_selector',
  'shopping_tutorial_tabs',
  'shopping_tutorial_add',
];

/** The List's two tabs. */
type ListTab = 'shopping' | 'purchased';

/** The swipe tip waits for a list long enough to tidy. */
const SWIPE_TIP_ROWS = 3;

const sameRect = (a: TargetRect | null | undefined, b: TargetRect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height);

interface FirstShopTourInput {
  /** The account has a list to shop from. */
  hasList: boolean;
  unpurchasedCount: number;
  /** A bought row is waiting to be put away. */
  hasPurchasedToMove: boolean;
  addButtonRect: TargetRect | null;
  /** The List is out of focus, or a selector covers it. */
  isPaused: boolean;
  /** @internal The wait before the first tip; 0 starts at once (tests). */
  startDelay?: number;
}

/**
 * The List's first-shop guide, four tips: the `+`, then a hint in the add
 * sheet until an item is added however it is added, then checking it off,
 * then putting it away once moved to the pantry however it is moved. Apart
 * from it, a tip showing the row swipe once the list holds three items.
 */
export function useFirstShopTour({
  hasList,
  unpurchasedCount,
  hasPurchasedToMove,
  addButtonRect,
  isPaused,
  startDelay,
}: FirstShopTourInput) {
  const { t } = useTranslation();
  const userId = useUserId();
  const [rects, setRects] = useState<
    Partial<Record<FirstShopTarget, TargetRect | null>>
  >({});
  const registerRect = (key: FirstShopTarget, rect: TargetRect | null) => {
    setRects(previous =>
      sameRect(previous[key], rect) ? previous : { ...previous, [key]: rect },
    );
  };
  const targetRects = { ...rects, addButton: addButtonRect };
  // A row on the tab not shown sits off screen, so its parts are measured
  // only once their tab shows.
  const [tabShown, setTabShown] = useState<ListTab>('shopping');

  const session = useTutorialSession();
  const finishedEarlier = EARLIER_TUTORIAL.some(featureId =>
    hasFeatureHintBeenShown(featureId, userId),
  );

  const guide = useTutorialSequence({
    tourId: GUIDE_TOURS.shop,
    steps: [
      {
        featureId: FIRST_SHOP_STEP.add,
        title: t('shoppingListTutorial.addButton.title'),
        subtitle: t('shoppingListTutorial.addButton.subtitle'),
        rectKey: 'addButton',
      },
      // The sheet reads the second line when it has no suggestions to tap.
      {
        featureId: FIRST_SHOP_STEP.pick,
        title: t('addToShoppingListSheet.tutorialTapPlus'),
        subtitle: t('addToShoppingListSheet.tutorialTapAddManually'),
        rectKey: 'addSheet',
        presentation: 'inline',
        advanceOn: { event: 'list.itemAdded' },
      },
      {
        featureId: FIRST_SHOP_STEP.check,
        title: t('labels.markAsPurchased'),
        subtitle: t('shoppingListTutorial.checkbox.subtitle'),
        rectKey: 'checkbox',
      },
      {
        featureId: FIRST_SHOP_STEP.putAway,
        title: t('shoppingListTutorial.moveToPantry.title'),
        subtitle: t('shoppingListTutorial.moveToPantry.subtitle'),
        rectKey: 'archiveIcon',
        advanceOn: { event: 'list.movedToPantry' },
      },
    ],
    targetRects,
    // Started from Getting started, it runs whatever came before.
    canStart:
      hasList &&
      (!finishedEarlier || session.startedGuides.has(GUIDE_TOURS.shop)),
    isPaused,
    startDelay,
  });

  const guideIdle =
    guide.currentStep === null &&
    guide.inlineStep === null &&
    guide.activeRectKey === null;
  const swipeTip = useTutorialSequence({
    tourId: 'list_swipe',
    steps: [
      {
        featureId: 'shopping_list_swipe',
        title: t('shoppingListTutorial.swipeActions.title'),
        subtitle: t('shoppingListTutorial.swipeActions.subtitle'),
        rectKey: 'itemCard',
        demo: 'swipe',
      },
    ],
    targetRects,
    canStart:
      guideIdle &&
      tabShown === 'shopping' &&
      unpurchasedCount >= SWIPE_TIP_ROWS,
    isPaused,
    startDelay,
  });

  const wants = (key: FirstShopTarget, tab: ListTab) =>
    tabShown === tab &&
    (guide.activeRectKey === key ||
      (key === 'itemCard' &&
        swipeTip.activeRectKey === key &&
        unpurchasedCount >= SWIPE_TIP_ROWS));

  // Checking off happens on Shopping, putting away on Purchased.
  const tabForGuide: ListTab | null =
    guide.activeRectKey === 'checkbox' && unpurchasedCount > 0
      ? 'shopping'
      : guide.activeRectKey === 'archiveIcon' && hasPurchasedToMove
      ? 'purchased'
      : null;

  return {
    guide,
    swipeTip,
    /** Which row targets a tip waits on, for the first row to measure. */
    wanted: {
      checkbox: wants('checkbox', 'shopping'),
      archiveIcon: wants('archiveIcon', 'purchased'),
      itemCard: wants('itemCard', 'shopping'),
    },
    registerRect,
    /** The tab the guide's next tip points into, for the list to show. */
    tabForGuide,
    /** The list reports the tab it shows. */
    noteTab: setTabShown,
  };
}

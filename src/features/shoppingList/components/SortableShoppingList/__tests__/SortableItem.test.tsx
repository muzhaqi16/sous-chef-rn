import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  renderWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { withDeadline } from '#/test-utils/cacheWaits';
import { shoppingListRowItem } from '#/test-utils/fixtures/shoppingListRowItem';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';
import { queuedMutationFor } from '#/test-utils/queuedMutation';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus } from '#/apollo/offlineQueue/types';
import { useStore } from '#store';
import { t } from '#/i18n';
import { Telemetry } from '#services/telemetry';
import { markFeatureHintShown } from '#hooks/settings/useFeatureHint';
import {
  startTutorialSession,
  tutorialSession,
} from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';
import { onTutorialEvent } from '#domain/tutorialEvents';
import {
  EntryImageSource,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import {
  deleteAction,
  editAction,
} from '#components/organisms/SwipeableItem/commonActions';
import { ItemSwipeActionsProvider } from '#components/organisms/itemSwipeActionsContext';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { FIRST_SHOP_STEP } from '#features/shoppingList/context/useFirstShopTour';
import {
  FirstShopTourProvider,
  useFirstShopTourContext,
} from '#features/shoppingList/context/FirstShopTourContext';
import { SwipeableListItem } from '../SortableItem';
import {
  SortableItem_ItemFragmentDoc,
  type SortableItem_ItemFragment,
} from '../SortableItem.generated';
import type { DeepPartial } from '@apollo/client/utilities';
import type { Unmasked } from '@apollo/client/masking';
import {
  SortableListActionsProvider,
  type SortableListActions,
  type SortableListPermissions,
} from '../SortableListActionsContext';
import { ShoppingListRowOptionsContext } from '../SortableListThemeContext';

// Jest lays nothing out, so a measured tip target reports a fixed rect.
jest.mock('#hooks/ui/useMeasuredRect', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    useMeasuredRect: (
      onMeasure?: (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void,
    ) => {
      useMountEffect(() => {
        onMeasure?.({ x: 16, y: 120, width: 300, height: 56 });
      }, [onMeasure]);
      return { ref: { current: null }, measure: () => undefined };
    },
  };
});

const USER_ID = 'user-1';
const ID = 'item-1';

type Line = DeepPartial<Unmasked<SortableItem_ItemFragment>>;

/** The line as its row reads it: a litre of milk, to buy. */
const milk = (overrides: Line = {}): Line => ({
  __typename: 'ShoppingListItem',
  id: ID,
  image: null,
  itemName: 'Milk',
  quantity: 1,
  quantityInput: null,
  category: 'Dairy',
  unitName: null,
  unit: null,
  amount: null,
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: false,
    movedToPantryAt: null,
  },
  suggestedPrice: null,
  item: null,
  ...overrides,
});

const bought = (
  movedToPantryAt: string | null = null,
): Line['purchaseInfo'] => ({
  __typename: 'ShoppingListItemPurchaseInfo',
  isPurchased: true,
  movedToPantryAt,
});

const EVERYTHING: SortableListPermissions = {
  canRemoveItems: true,
  canEditItems: true,
  canMarkPurchased: true,
};
const VIEWER: SortableListPermissions = {
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: false,
};

const actions = {
  onItemPress: jest.fn(),
  onTogglePurchase: jest.fn(),
  onMoveToPantry: jest.fn(),
  onQuantityPress: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

interface Row {
  entry?: Line | null;
  isPurchased?: boolean;
  index?: number;
  permissions?: SortableListPermissions;
  readingSystem?: UnitSystem.Metric | UnitSystem.Imperial;
  showPrices?: boolean;
  showImages?: boolean;
}

/** The row as its list renders it, inside the list's providers. */
function RowUnderTest({
  isPurchased = false,
  index = 0,
  permissions = EVERYTHING,
  readingSystem = UnitSystem.Metric,
  showPrices = true,
  showImages = true,
}: Omit<Row, 'entry'>) {
  const listActions: SortableListActions = {
    onItemPress: actions.onItemPress,
    onTogglePurchase: actions.onTogglePurchase,
    onMoveToPantry: actions.onMoveToPantry,
    onQuantityPress: actions.onQuantityPress,
  };
  return (
    <SortableListActionsProvider
      actions={listActions}
      permissions={permissions}
    >
      <ItemSwipeActionsProvider
        value={id => ({
          left: [editAction(() => actions.onEdit(id))],
          right: [deleteAction(() => actions.onDelete(id))],
        })}
      >
        <ShoppingListRowOptionsContext.Provider
          value={{ showImages, readingSystem, showPrices }}
        >
          <SwipeableListItem
            item={shoppingListRowItem(ID, { isPurchased })}
            index={index}
            target="Cell"
          />
        </ShoppingListRowOptionsContext.Provider>
      </ItemSwipeActionsProvider>
    </SortableListActionsProvider>
  );
}

function renderRow({ entry = milk(), ...row }: Row = {}) {
  const cache = makeCache();
  if (entry) {
    seedFragment(cache, {
      fragment: SortableItem_ItemFragmentDoc,
      data: entry,
    });
  }
  return renderWithApollo(<RowUnderTest {...row} />, { cache });
}

const row = () => screen.getByTestId(shoppingListTestIDs.itemRow(ID));

/** Runs a swipe action as a screen reader offers it. */
const swipe = (actionName: 'edit' | 'delete') =>
  fireEvent(row(), 'accessibilityAction', { nativeEvent: { actionName } });

beforeEach(() => {
  jest.clearAllMocks();
  queueStore.removeMutation(`mut-${ID}`);
});

describe('a line to buy', () => {
  it('shows its name and the first of its categories', () => {
    renderRow({ entry: milk({ category: 'Dairy, Breakfast' }) });

    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Dairy')).toBeTruthy();
  });

  it('shows the unit it was typed with', () => {
    renderRow({ entry: milk({ quantity: 2, unitName: 'bunches' }) });

    expect(screen.getByLabelText('Milk, Dairy, 2 bunches')).toBeTruthy();
  });

  // The household overrides the catalog's photo on its own entries.
  it("shows the household's photo, and none with photos off", () => {
    const entry = milk({
      image: {
        __typename: 'EntryImage',
        url: 'https://cdn.example.com/our-milk.jpg',
        source: EntryImageSource.Household,
        catalogImageId: null,
      },
    });
    const photos = () =>
      screen.UNSAFE_root.findAll(
        node =>
          node.props.source?.uri === 'https://cdn.example.com/our-milk.jpg',
      );

    const { unmount } = renderRow({ entry });
    expect(photos().length).toBeGreaterThan(0);
    unmount();

    renderRow({ entry, showImages: false });
    expect(photos()).toEqual([]);
  });

  it('is ticked from its checkbox, which carries its name', () => {
    renderRow();

    fireEvent.press(screen.getByLabelText('Milk'));

    expect(actions.onTogglePurchase).toHaveBeenCalledWith(ID);
  });

  it('opens on a press, and records an amount on a long-press', () => {
    renderRow();

    fireEvent.press(row());
    fireEvent(row(), 'longPress');

    expect(actions.onItemPress).toHaveBeenCalledWith(ID);
    expect(actions.onTogglePurchase).toHaveBeenCalledWith(ID, {
      withDetails: true,
    });
  });

  it('opens its quantity', () => {
    renderRow();

    fireEvent.press(screen.getByTestId(shoppingListTestIDs.itemQuantity(ID)));

    expect(actions.onQuantityPress).toHaveBeenCalledWith(ID);
  });

  it('is edited and deleted from its swipe', () => {
    renderRow();

    swipe('edit');
    swipe('delete');

    expect(actions.onEdit).toHaveBeenCalledWith(ID);
    expect(actions.onDelete).toHaveBeenCalledWith(ID);
  });

  // The swipe is the gesture library's; its will-open stands for the finger.
  it('tells the List’s tips when it is swiped open', () => {
    const heard: string[] = [];
    const stop = onTutorialEvent(event => heard.push(event));
    renderRow();

    const [swipeable] = screen.UNSAFE_root.findAll(
      node => typeof node.props.onSwipeableWillOpen === 'function',
    );
    swipeable?.props.onSwipeableWillOpen('right');
    stop();

    expect(heard).toEqual(['list.rowSwiped']);
  });

  it('gives a viewer no checkbox, quantity or swipe', () => {
    renderRow({ permissions: VIEWER });

    expect(screen.queryByLabelText('Milk')).not.toBeOnTheScreen();
    expect(
      screen.getByTestId(shoppingListTestIDs.itemQuantity(ID)),
    ).toBeDisabled();
    swipe('edit');
    swipe('delete');
    expect(actions.onEdit).not.toHaveBeenCalled();
    expect(actions.onDelete).not.toHaveBeenCalled();
  });

  it('draws an empty slot while the line is not cached', () => {
    renderRow({ entry: null });

    expect(
      screen.queryByTestId(shoppingListTestIDs.itemRow(ID)),
    ).not.toBeOnTheScreen();
  });
});

describe('its price', () => {
  const suggestedPrice: NonNullable<Line['suggestedPrice']> = {
    __typename: 'PriceSuggestion',
    amount: 1.25,
    substitute: false,
    currency: {
      __typename: 'Currency',
      id: 'cur-usd',
      code: 'USD',
      decimalPlaces: 2,
    },
  };

  // Per one of the line's unit, so the line costs that times its quantity.
  it('is what the line would cost, beside its category', () => {
    renderRow({ entry: milk({ quantity: 2, suggestedPrice }) });

    expect(screen.getByText(/^Dairy · ≈ .*2\.50$/)).toBeTruthy();
  });

  it("says when it is similar products' price, not the line's own", () => {
    renderRow({
      entry: milk({ suggestedPrice: { ...suggestedPrice, substitute: true } }),
    });

    expect(
      screen.getByText(/^Dairy · ≈ .*1\.25, similar products$/),
    ).toBeTruthy();
  });

  it('is not shown with budget and prices turned off', () => {
    renderRow({ entry: milk({ suggestedPrice }), showPrices: false });

    expect(screen.queryByText(/≈/)).not.toBeOnTheScreen();
  });

  it('is not shown on a bought line', () => {
    renderRow({
      entry: milk({ suggestedPrice, purchaseInfo: bought() }),
      isPurchased: true,
    });

    expect(screen.queryByText(/≈/)).not.toBeOnTheScreen();
  });
});

describe('a line waiting to sync', () => {
  it('says so, beside it and to a screen reader', () => {
    // The queue reports only the signed-in person's writes.
    queueStore.setCurrentUserId(USER_ID);
    queueStore.addMutation({
      id: `mut-${ID}`,
      userId: USER_ID,
      ...queuedMutationFor(UpdateShoppingListItemDocument),
      variables: { input: { id: ID, quantity: 4 } },
      status: QueueStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      requiresAuth: true,
    });

    renderRow();

    expect(
      screen.getByTestId(shoppingListTestIDs.itemPendingSync(ID)),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(`Milk, ${t('status.syncing')}, 1`),
    ).toBeTruthy();
  });
});

describe('a bought line', () => {
  it('says it is bought, and is put away from its archive', () => {
    renderRow({ entry: milk({ purchaseInfo: bought() }), isPurchased: true });

    expect(
      screen.getByLabelText(`Milk, ${t('labels.purchased')}, Dairy, 1`),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.itemMoveToPantry(ID)),
    );

    expect(actions.onMoveToPantry).toHaveBeenCalledWith(ID);
  });

  it('shows as stocked once it is in the pantry, with no move', () => {
    renderRow({
      entry: milk({ purchaseInfo: bought('2026-11-01T10:00:00.000Z') }),
      isPurchased: true,
    });

    expect(
      screen.getByTestId(shoppingListTestIDs.itemStocked(ID)),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(shoppingListTestIDs.itemMoveToPantry(ID)),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        `Milk, ${t('labels.purchased')}, Dairy, 1, ${t(
          'shoppingList.alreadyInPantry',
        )}`,
      ),
    ).toBeTruthy();
  });

  it('keeps its quantity, and opens on a long-press rather than recording', () => {
    renderRow({ entry: milk({ purchaseInfo: bought() }), isPurchased: true });

    expect(
      screen.getByTestId(shoppingListTestIDs.itemQuantity(ID)),
    ).toBeDisabled();
    fireEvent(row(), 'longPress');

    expect(actions.onItemPress).toHaveBeenCalledWith(ID);
    expect(actions.onTogglePurchase).not.toHaveBeenCalled();
  });
});

// The server reads a line's weight or volume in each unit system; the row
// shows the user's while that reading still describes the line.
describe('the amount in the user’s unit system', () => {
  const unit = (id: string, symbol: string, type: UnitType) =>
    readingAsAbbreviation({
      unitId: id,
      symbol,
      displayAsFraction: false,
      type,
    });
  const pounds = (typed: number, kilograms: number) =>
    milk({
      quantity: typed,
      quantityInput: String(typed),
      unit: asAbbreviation({ __typename: 'Unit', id: 'unit-lb', symbol: 'lb' }),
      amount: {
        __typename: 'Measure',
        value: typed,
        unitId: 'unit-lb',
        metric: {
          __typename: 'MeasureReading',
          value: kilograms,
          ...unit('unit-kg', 'kg', UnitType.Weight),
        },
        imperial: {
          __typename: 'MeasureReading',
          value: typed,
          ...unit('unit-lb', 'lb', UnitType.Weight),
        },
      },
    });

  it('reads a line typed in pounds in kilograms for a metric user', () => {
    renderRow({ entry: pounds(2, 0.91) });

    expect(screen.getByLabelText('Milk, Dairy, 0.91 kg')).toBeTruthy();
  });

  it('reads it in pounds for an imperial user', () => {
    renderRow({ entry: pounds(2, 0.91), readingSystem: UnitSystem.Imperial });

    expect(screen.getByLabelText('Milk, Dairy, 2 lb')).toBeTruthy();
  });

  // A kilogram is a unit nobody halves, as the pantry writes it too.
  it('writes a reading in its unit’s notation, never "1/2 kg"', () => {
    renderRow({ entry: pounds(1.1, 0.5) });

    expect(screen.getByLabelText('Milk, Dairy, 0.5 kg')).toBeTruthy();
  });
});

/** Resolves once the tour reports `event` for `featureId`. */
const tourReports = (event: string, featureId: string) =>
  withDeadline(
    done => {
      jest.spyOn(Telemetry, 'trackEvent').mockImplementation((name, props) => {
        if (name === event && props?.feature_id === featureId) done();
      });
      return () => undefined;
    },
    () => `the tour never reported ${event} for ${featureId}`,
  );

/** Tells the tour which tab shows, as the list's tabs do. */
function TabShown({ tab }: { tab: 'shopping' | 'purchased' }) {
  const noteTab = useFirstShopTourContext()?.noteTab;
  React.useEffect(() => noteTab?.(tab), [noteTab, tab]);
  return null;
}

interface Tour {
  unpurchasedCount: number;
  hasPurchasedToMove?: boolean;
  tab?: 'shopping' | 'purchased';
}

/** The row first in its list, under the List's tips. */
function TourRow({
  unpurchasedCount,
  hasPurchasedToMove = false,
  tab = 'shopping',
  ...rowProps
}: Tour & Omit<Row, 'entry'>) {
  return (
    <FirstShopTourProvider
      hasList
      unpurchasedCount={unpurchasedCount}
      hasPurchasedToMove={hasPurchasedToMove}
      addButtonRect={{ x: 300, y: 760, width: 56, height: 56 }}
      isPaused={false}
    >
      <TabShown tab={tab} />
      <RowUnderTest {...rowProps} />
    </FirstShopTourProvider>
  );
}

function renderTourRow(entry: Line, tour: Tour & Row) {
  const cache = makeCache();
  seedFragment(cache, { fragment: SortableItem_ItemFragmentDoc, data: entry });
  return renderWithApollo(<TourRow {...tour} />, { cache });
}

/** The first-shop guide started from Getting started, `done` steps behind it. */
const guideAt = (...done: string[]) => {
  done.forEach(step => markFeatureHintShown(step, USER_ID));
  tutorialSession.startGuide(GUIDE_TOURS.shop);
};

// A tip's target that is gone must say so, or the tip spotlights nothing: the
// tour then gives up on it, which is what each test waits for.
describe('the first row under the List’s tips', () => {
  beforeEach(() => {
    useStore.setState({
      user: {
        id: USER_ID,
        email: 'cook@example.com',
        emailVerified: true,
        onBoarded: true,
      },
      showTutorials: true,
      featureHintsShown: {},
      lastUnpromptedTipAt: {},
    });
    markFeatureHintShown('shopping_interactive_tutorial', USER_ID);
    tutorialSession.endGuide(GUIDE_TOURS.shop);
    startTutorialSession();
  });

  it('is never the check step’s target once bought', async () => {
    guideAt(FIRST_SHOP_STEP.add, FIRST_SHOP_STEP.pick);
    const gaveUp = tourReports('tour_target_timeout', FIRST_SHOP_STEP.check);

    renderTourRow(milk({ purchaseInfo: bought() }), {
      unpurchasedCount: 1,
      isPurchased: true,
    });

    await expect(gaveUp).resolves.toBeUndefined();
  });

  it('lets the check step go once it is ticked', async () => {
    guideAt(FIRST_SHOP_STEP.add, FIRST_SHOP_STEP.pick);
    const viewed = tourReports('tour_step_viewed', FIRST_SHOP_STEP.check);
    const view = renderTourRow(milk(), { unpurchasedCount: 1 });
    await viewed;
    const gaveUp = tourReports('tour_target_timeout', FIRST_SHOP_STEP.check);

    view.rerender(<TourRow unpurchasedCount={1} isPurchased />);

    await expect(gaveUp).resolves.toBeUndefined();
  });

  it('lets the put-away step go once it is back on the list', async () => {
    guideAt(FIRST_SHOP_STEP.add, FIRST_SHOP_STEP.pick, FIRST_SHOP_STEP.check);
    const viewed = tourReports('tour_step_viewed', FIRST_SHOP_STEP.putAway);
    const view = renderTourRow(milk({ purchaseInfo: bought() }), {
      unpurchasedCount: 0,
      hasPurchasedToMove: true,
      tab: 'purchased',
      isPurchased: true,
    });
    await viewed;
    const gaveUp = tourReports('tour_target_timeout', FIRST_SHOP_STEP.putAway);

    view.rerender(
      <TourRow unpurchasedCount={0} hasPurchasedToMove tab="purchased" />,
    );

    await expect(gaveUp).resolves.toBeUndefined();
  });

  it('lets the swipe tip go once it is ticked', async () => {
    tutorialSession.startGuide('list_swipe');
    const viewed = tourReports('tour_step_viewed', 'shopping_list_swipe');
    const view = renderTourRow(milk(), { unpurchasedCount: 3 });
    await viewed;
    const gaveUp = tourReports('tour_target_timeout', 'shopping_list_swipe');

    view.rerender(<TourRow unpurchasedCount={3} isPurchased />);

    await expect(gaveUp).resolves.toBeUndefined();
  });
});

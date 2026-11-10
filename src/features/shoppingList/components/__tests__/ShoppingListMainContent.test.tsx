'use no memo';

import { t } from '#/i18n';
import React from 'react';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ShoppingListMainContent,
  type ShoppingListMainContentProps,
} from '#features/shoppingList/components/ShoppingListMainContent';
import { useFirstShopTourContext } from '#features/shoppingList/context/FirstShopTourContext';
import { FIRST_SHOP_STEP } from '#features/shoppingList/context/useFirstShopTour';
import {
  useAnyShoppingListSheetVisible,
  useShoppingListModalActions,
} from '#features/shoppingList/context/ShoppingListModalsContext';
import { useShoppingListActions } from '#features/shoppingList/hooks/useShoppingListActions';
import { useTabBarAddMenu } from '#hooks/navigation/useTabBarAddMenu';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { getShoppingListPermissionsWithOwner } from '#features/shoppingList/utils/shoppingListPermissions';
import * as selectorModalModule from '#features/shoppingList/components/useShoppingListSelectorModal';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import type { BarAction } from '#components/molecules/BarActions';
import type { EmptyStateProps } from '#components/molecules/EmptyState';
import { useStore } from '#store';
import { fireEvent, userEvent } from '@testing-library/react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useStoreModeEnabled } from '#features/shoppingList/hooks/useStoreModeEnabled';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';

type ScreenData = ShoppingListMainContentProps['screenData'];

const render = (ui: React.ReactElement) => renderWithApollo(ui);

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/shoppingList/hooks/useStoreModeEnabled', () => ({
  useStoreModeEnabled: jest.fn(() => false),
}));
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => false),
}));
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));

jest.mock('#hooks/navigation/useTabBarAddMenu', () => ({
  useTabBarAddMenu: jest.fn(),
}));

jest.mock('#hooks/settings/useFeatureHint', () => ({
  useFeatureHint: jest.fn(() => ({
    isVisible: false,
    hasBeenShown: false,
    actions: { show: jest.fn(), dismiss: jest.fn() },
  })),
}));

jest.mock('#features/shoppingList/hooks/useShoppingListActions', () => ({
  useShoppingListActions: jest.fn(() => ({
    handleTogglePurchase: jest.fn(),
    handleDeleteItem: jest.fn(),
    handleClearAllPurchased: jest.fn(),
    handleClearAllShopping: jest.fn(),
  })),
}));

jest.mock('#features/shoppingList/hooks/useBatchMoveToPantry', () => ({
  useBatchMoveToPantry: jest.fn(() => ({
    batchMoveToPantry: jest.fn(),
    loading: false,
  })),
}));

jest.mock(
  '#features/shoppingList/components/useShoppingListSelectorModal',
  () => ({
    useShoppingListSelectorModal: jest.fn(() => ({
      selectorRef: { current: null },
      listConfig: {},
      handleOpenSelector: jest.fn(),
      handleOverlayOpen: jest.fn(),
      handleOverlayClose: jest.fn(),
    })),
  }),
);

jest.mock('#features/shoppingList/hooks/useItemReordering', () => ({
  useItemReordering: jest.fn(() => ({
    handleSortOrderUpdate: jest.fn(),
  })),
}));

const mockCloseAllRows = jest.fn();
jest.mock('#hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: jest.fn(() => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
    closeAll: mockCloseAllRows,
  })),
}));

const mockSetAddMenuOpen = jest.fn();
jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: jest.fn(() => ({
    setOverlayOpen: jest.fn(),
    setScannerProps: jest.fn(),
    setAddMenuOpen: mockSetAddMenuOpen,
  })),
  useTabBarState: jest.fn(() => ({
    addButtonRect: null,
    isOverlayOpen: false,
  })),
}));

jest.mock('#hooks/ui/useTutorialSequence', () => ({
  useTutorialSequence: jest.fn(() => ({
    isActive: false,
    currentStep: null,
    advance: jest.fn(),
    skipAll: jest.fn(),
  })),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

const mockOpenAddItemSheet = jest.fn();
const mockOpenAddItemManually = jest.fn();
const mockOpenMoveToPantry = jest.fn();
jest.mock('#features/shoppingList/context/ShoppingListModalsContext', () => ({
  useShoppingListModalActions: jest.fn(() => ({
    openAddItemSheet: mockOpenAddItemSheet,
    openAddItemManually: mockOpenAddItemManually,
    openQuantityEdit: jest.fn(),
    openPurchaseAmount: jest.fn(),
    openMoveToPantry: mockOpenMoveToPantry,
    openMoveToAisle: jest.fn(),
  })),
  useAnyShoppingListSheetVisible: jest.fn(() => false),
}));

jest.mock('#features/shoppingList/context/FirstShopTourContext', () => ({
  useFirstShopTourContext: jest.fn(() => null),
}));

jest.mock('#features/shoppingList/utils/shoppingListPermissions', () => ({
  getShoppingListPermissionsWithOwner: jest.fn(() => ({
    canAddItems: true,
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
  })),
}));

// Opens through its imperative handle, as the real tray does, and then lists
// the config's rows so a test can pick one.
jest.mock(
  '#components/organisms/AnimatedItemSelector/AnimatedItemSelector',
  () => {
    const { forwardRef, useImperativeHandle, useState } = require('react');
    const { Pressable, View } = require('react-native');
    return {
      AnimatedItemSelector: forwardRef(
        (
          {
            config,
          }: {
            config: {
              data?: Array<{ id: string }>;
              onSelect?: (id: string, item: { id: string }) => void;
            };
          },
          ref: unknown,
        ) => {
          const [open, setOpen] = useState(false);
          useImperativeHandle(ref, () => ({
            open: () => setOpen(true),
            close: () => setOpen(false),
            isActive: () => open,
            toggle: () => setOpen((wasOpen: boolean) => !wasOpen),
          }));
          return (
            <View testID="list-selector">
              {open
                ? (config.data ?? []).map(item => (
                    <Pressable
                      key={item.id}
                      testID={`list-selector-row-${item.id}`}
                      onPress={() => config.onSelect?.(item.id, item)}
                    />
                  ))
                : null}
            </View>
          );
        },
      ),
    };
  },
);

// Holds the row handlers the list renders with, so a test can tick a row.
let mockListProps: {
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
} = {};
let mockEmptyState: EmptyStateProps | undefined;
jest.mock('#features/shoppingList/components/ListTemplate', () => ({
  ListTemplate: ({
    customListProps,
    emptyState,
  }: {
    customListProps: typeof mockListProps;
    emptyState?: EmptyStateProps;
  }) => {
    mockListProps = customListProps;
    mockEmptyState = emptyState;
    return null;
  },
}));

jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({
    title,
    actions,
    switchable,
  }: {
    title: string;
    actions?: BarAction[];
    switchable?: { onPress: () => void; testID?: string };
  }) => {
    const { Pressable, Text } = require('react-native');
    const { BarActions } = require('#components/molecules/BarActions');
    return (
      <>
        {switchable ? (
          <Pressable onPress={switchable.onPress} testID={switchable.testID}>
            <Text>{title}</Text>
          </Pressable>
        ) : (
          title
        )}
        <BarActions actions={actions} placement="gutter" />
      </>
    );
  },
}));

jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: () => null,
}));

jest.mock(
  '#features/shoppingList/components/ShoppingListTabs/ShoppingListTabs',
  () => ({
    ShoppingListTabs: () => null,
  }),
);

jest.mock(
  '#components/organisms/SpotlightCoachMark/SpotlightCoachMark',
  () => ({
    SpotlightCoachMark: ({
      title,
      onTargetPress,
    }: {
      title: string;
      onTargetPress?: () => void;
    }) => {
      const { Text } = require('react-native');
      return (
        <Text testID="spotlight-coach-mark" onPress={onTargetPress}>
          {title}
        </Text>
      );
    },
  }),
);

type ScreenDataOverrides = {
  state?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  [key: string]: unknown;
};

const makeScreenData = (overrides: ScreenDataOverrides = {}): ScreenData => {
  const {
    state: stateOverrides,
    actions: actionsOverrides,
    ...legacyOverrides
  } = overrides;
  const data: Record<string, unknown> = {
    state: {
      lists: [{ id: 'list-1', name: 'Groceries' }],
      listDataWithOwnership: [
        { id: 'list-1', name: 'Groceries', _isOwner: true },
      ],
      currentList: { id: 'list-1', name: 'Groceries' },
      // A list on screen always has a detail record; without one the screen
      // cannot say what this person may do and offers a retry instead.
      currentListDetails: { id: 'list-1', homeId: null, ownerships: [] },
      currentListId: 'list-1',
      unpurchasedItems: [],
      purchasedItems: [],
      rawUnpurchasedItems: [],
      rawPurchasedItems: [],
      isLoadingInitial: false,
      detailsLoading: false,
      searchQuery: '',
      totalCountUnpurchased: 0,
      totalCountPurchased: 0,
      hasMoreUnpurchased: false,
      isLoadingMoreUnpurchased: false,
      hasMorePurchased: false,
      isLoadingMorePurchased: false,
      isTransitioning: false,
      ...legacyOverrides,
      ...stateOverrides,
    },
    actions: {
      setSearchQuery: jest.fn(),
      toggleItem: jest.fn(),
      removeItem: jest.fn(),
      refetch: jest.fn().mockResolvedValue({}),
      loadMoreUnpurchased: jest.fn(),
      loadMorePurchased: jest.fn(),
      setSelectedShoppingListId: jest.fn(),
      ...actionsOverrides,
    },
  };
  return data as ScreenData;
};

const RECT = { x: 0, y: 0, width: 10, height: 10 };

/** A tour sequence with nothing showing, unless a step is given. */
const sequence = (
  step: { featureId: string; title: string } | null = null,
) => ({
  currentStep: step
    ? {
        ...step,
        targetRect: RECT,
        subtitle: '',
        stepIndex: 0,
        totalSteps: 4,
        waitsForAction: false,
      }
    : null,
  inlineStep: null,
  activeRectKey: null,
  advance: jest.fn(),
  advanceInPlace: jest.fn(),
  skipAll: jest.fn(),
  pause: jest.fn(),
});

const makeTour = (
  overrides: {
    guide?: ReturnType<typeof sequence>;
    swipeTip?: ReturnType<typeof sequence>;
    receiptTip?: ReturnType<typeof sequence>;
    wanted?: Partial<Record<'checkbox' | 'archiveIcon' | 'itemCard', boolean>>;
  } = {},
) => ({
  guide: overrides.guide ?? sequence(),
  swipeTip: overrides.swipeTip ?? sequence(),
  receiptTip: overrides.receiptTip ?? sequence(),
  wanted: {
    checkbox: false,
    archiveIcon: false,
    itemCard: false,
    ...overrides.wanted,
  },
  registerRect: jest.fn(),
  tabForGuide: null,
  noteTab: jest.fn(),
});

describe('ShoppingListMainContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useFirstShopTourContext as jest.Mock).mockReturnValue(null);
    (useAnyShoppingListSheetVisible as jest.Mock).mockReturnValue(false);
  });

  it('renders shopping list screen', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent screenData={makeScreenData()} />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('shows empty state when no lists exist', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent screenData={makeScreenData({ lists: [] })} />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('offers to create a list from the + when there is none, not a wait', () => {
    render(
      <ShoppingListMainContent
        screenData={makeScreenData({
          lists: [],
          listsLoading: false,
          listsHasResult: true,
        })}
      />,
    );

    const menu = jest.mocked(useTabBarAddMenu).mock.calls.at(-1)?.[0] ?? [];
    expect(menu.map(action => action.key)).toEqual(['createList']);
    expect(menu[0]?.disabledReason).toBeUndefined();
  });

  it('renders with items', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent
        screenData={makeScreenData({
          unpurchasedItems: [
            { id: 'item-1', name: 'Milk', purchaseInfo: null },
          ],
        })}
      />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('renders with loading state', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent
        screenData={makeScreenData({ isLoadingInitial: true })}
      />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  describe('ticking a line', () => {
    const tickWithPricesOn = (opts?: { withDetails?: boolean }) => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
      const toggle = jest.fn();
      const openPurchaseAmount = jest.fn();
      jest.mocked(useShoppingListActions).mockReturnValue({
        handleTogglePurchase: toggle,
        handleDeleteItem: jest.fn(),
        handleClearAllPurchased: jest.fn(),
        handleClearAllShopping: jest.fn(),
      });
      jest.mocked(useShoppingListModalActions).mockReturnValue({
        ...jest.mocked(useShoppingListModalActions)(),
        openPurchaseAmount,
      });
      const milk = { id: 'item-1', name: 'Milk', purchaseInfo: null };
      render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            unpurchasedItems: [milk],
            rawUnpurchasedItems: [milk],
          })}
        />,
      );
      mockListProps.onTogglePurchase?.('item-1', opts);
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
      return { toggle, openPurchaseAmount };
    };

    // Prices are gathered by long-press only: a tick never asks for one.
    it('marks the line bought with no sheet, with prices on', () => {
      const { toggle, openPurchaseAmount } = tickWithPricesOn();

      expect(toggle).toHaveBeenCalledWith('item-1');
      expect(openPurchaseAmount).not.toHaveBeenCalled();
    });

    it('opens the purchase sheet on a long-press', () => {
      const { toggle, openPurchaseAmount } = tickWithPricesOn({
        withDetails: true,
      });

      expect(openPurchaseAmount).toHaveBeenCalledWith('item-1');
      expect(toggle).not.toHaveBeenCalled();
    });
  });

  describe('store mode', () => {
    it('offers no way in until it is turned on in Settings', () => {
      const { queryByTestId } = render(
        <ShoppingListMainContent screenData={makeScreenData()} />,
      );

      expect(queryByTestId(shoppingListTestIDs.storeModeButton)).toBeNull();
    });

    it('opens store mode on the list on screen', () => {
      jest.mocked(useStoreModeEnabled).mockReturnValue(true);
      const screenData = makeScreenData();
      const { getByTestId } = render(
        <ShoppingListMainContent screenData={screenData} />,
      );

      fireEvent.press(getByTestId(shoppingListTestIDs.storeModeButton));

      expect(jest.mocked(useAppNavigation)().toStoreMode).toHaveBeenCalledWith({
        listId: screenData.state.currentListId,
      });
      jest.mocked(useStoreModeEnabled).mockReturnValue(false);
    });
  });

  // A basic list unless the person turns the extras on.
  describe('budget and prices', () => {
    afterEach(() => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
      jest.mocked(useStoreModeEnabled).mockReturnValue(false);
    });

    it('offers no way in, and no header action at all, with both extras off', () => {
      const { queryByTestId } = render(
        <ShoppingListMainContent screenData={makeScreenData()} />,
      );

      expect(
        queryByTestId(shoppingListTestIDs.budgetAndPricesButton),
      ).toBeNull();
      expect(queryByTestId(shoppingListTestIDs.storeModeButton)).toBeNull();
    });

    it('opens Budget & prices for the list on screen, beside store mode', () => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
      jest.mocked(useStoreModeEnabled).mockReturnValue(true);
      const screenData = makeScreenData();
      const { getByTestId } = render(
        <ShoppingListMainContent screenData={screenData} />,
      );

      expect(getByTestId(shoppingListTestIDs.storeModeButton)).toBeTruthy();
      fireEvent.press(getByTestId(shoppingListTestIDs.budgetAndPricesButton));

      expect(jest.mocked(useAppNavigation)().toListBudget).toHaveBeenCalledWith(
        { listId: screenData.state.currentListId },
      );
    });
  });

  it('renders with current list name', () => {
    const tree = render(
      <ShoppingListMainContent screenData={makeScreenData()} />,
    );
    expect(tree.toJSON()).toBeTruthy();
  });

  // A row left swiped open puts its checkbox beside where it rests, and the
  // spotlight would point at empty space.
  it('closes open rows when a tip points into a row', () => {
    (useFirstShopTourContext as jest.Mock).mockReturnValue(
      makeTour({ wanted: { checkbox: true } }),
    );

    render(
      <ShoppingListMainContent
        screenData={makeScreenData({ rawUnpurchasedItems: [{ id: 'item-1' }] })}
      />,
    );

    expect(mockCloseAllRows).toHaveBeenCalled();
  });

  describe('the first-shop guide and the swipe tip', () => {
    it('shows the guide’s step', () => {
      (useFirstShopTourContext as jest.Mock).mockReturnValue(
        makeTour({
          guide: sequence({ featureId: FIRST_SHOP_STEP.add, title: 'Add' }),
        }),
      );
      const { getByText } = render(
        <ShoppingListMainContent screenData={makeScreenData()} />,
      );
      expect(getByText('Add')).toBeTruthy();
    });

    it('opens the add sheet from the + step and moves to the sheet’s hint', () => {
      const guide = sequence({ featureId: FIRST_SHOP_STEP.add, title: 'Add' });
      (useFirstShopTourContext as jest.Mock).mockReturnValue(
        makeTour({ guide }),
      );
      const { getByTestId } = render(
        <ShoppingListMainContent screenData={makeScreenData()} />,
      );

      fireEvent.press(getByTestId('spotlight-coach-mark'));

      expect(mockOpenAddItemSheet).toHaveBeenCalledTimes(1);
      expect(guide.advanceInPlace).toHaveBeenCalledTimes(1);
    });

    it('opens Move to pantry for the bought row, leaving the move to continue the guide', () => {
      const guide = sequence({
        featureId: FIRST_SHOP_STEP.putAway,
        title: 'Put it away',
      });
      (useFirstShopTourContext as jest.Mock).mockReturnValue(
        makeTour({ guide }),
      );
      const { getByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({ rawPurchasedItems: [{ id: 'bought' }] })}
        />,
      );

      fireEvent.press(getByTestId('spotlight-coach-mark'));

      expect(mockOpenMoveToPantry).toHaveBeenCalledWith('bought');
      expect(guide.advance).not.toHaveBeenCalled();
    });

    it('shows the swipe tip when the guide shows nothing', () => {
      (useFirstShopTourContext as jest.Mock).mockReturnValue(
        makeTour({
          swipeTip: sequence({
            featureId: 'shopping_list_swipe',
            title: 'Swipe',
          }),
        }),
      );
      const { getByText } = render(
        <ShoppingListMainContent screenData={makeScreenData()} />,
      );
      expect(getByText('Swipe')).toBeTruthy();
    });

    it('Items checked off a list: a tip offers scanning the trip’s receipt', () => {
      const receiptTip = sequence({
        featureId: 'list_receipt_offer',
        title: 'Scan receipt',
      });
      (useFirstShopTourContext as jest.Mock).mockReturnValue(
        makeTour({ receiptTip }),
      );
      const { getByTestId } = render(
        <ShoppingListMainContent screenData={makeScreenData()} />,
      );

      fireEvent.press(getByTestId('spotlight-coach-mark'));

      expect(
        jest.mocked(useAppNavigation)().toReceiptScan,
      ).toHaveBeenCalledTimes(1);
      expect(receiptTip.advance).toHaveBeenCalledTimes(1);
    });

    it('hides every tip while a sheet is open', () => {
      (useFirstShopTourContext as jest.Mock).mockReturnValue(
        makeTour({
          guide: sequence({ featureId: FIRST_SHOP_STEP.check, title: 'Check' }),
        }),
      );
      (useAnyShoppingListSheetVisible as jest.Mock).mockReturnValue(true);
      const { queryByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            rawUnpurchasedItems: [{ id: 'item-1' }],
          })}
        />,
      );
      expect(queryByTestId('spotlight-coach-mark')).toBeNull();
    });
  });

  describe('when the item read fails', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      useStore.getState().setSelectedShoppingListId(null);
    });

    it('offers a retry rather than calling the list empty', () => {
      const { getByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            state: { error: new Error('Network request failed') },
          })}
        />,
      );

      expect(getByTestId('state-error')).toBeTruthy();
    });

    it('keeps the cached rows on screen', () => {
      const { queryByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            state: {
              error: new Error('Network request failed'),
              rawUnpurchasedItems: [{ id: 'item-1' }],
            },
          })}
        />,
      );

      expect(queryByTestId('state-error')).toBeNull();
    });

    // The header's switch-list button opens this; without it the person is
    // held on the failing list.
    it('keeps the list switcher mounted', () => {
      const { getByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            state: { error: new Error('Network request failed') },
          })}
        />,
      );

      expect(getByTestId('list-selector')).toBeTruthy();
    });
    it('opens the switcher from the header and switches to the picked list', async () => {
      jest
        .spyOn(selectorModalModule, 'useShoppingListSelectorModal')
        .mockImplementation(
          jest.requireActual(
            '#features/shoppingList/components/useShoppingListSelectorModal',
          ).useShoppingListSelectorModal,
        );
      const user = userEvent.setup();
      const lists = [
        { id: 'list-1', name: 'Groceries', homeId: null, _isOwner: true },
        { id: 'list-2', name: 'Hardware', homeId: null, _isOwner: true },
      ];
      const { getByTestId, queryByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            state: {
              error: new Error('Network request failed'),
              lists,
              listDataWithOwnership: lists,
            },
          })}
        />,
      );
      expect(getByTestId('state-error')).toBeTruthy();
      expect(queryByTestId('list-selector-row-list-2')).toBeNull();

      await user.press(getByTestId(shoppingListTestIDs.listSelectorButton));
      await user.press(getByTestId('list-selector-row-list-2'));

      expect(useStore.getState().selectedShoppingListId).toBe('list-2');
    });
  });

  describe('when the app cannot say what this person may do', () => {
    // The detail query is `errorPolicy: 'ignore'`, so a failure and a cache
    // that never held the list both arrive as no details at all. Rendering the
    // list anyway shows its OWNER a viewer's version of their own list.
    const withoutDetails = () =>
      makeScreenData({
        state: { currentListDetails: null, detailsLoading: false },
      });

    it('offers a retry instead of a list nobody is allowed to touch', () => {
      const { getByTestId } = render(
        <ShoppingListMainContent screenData={withoutDetails()} />,
      );

      expect(getByTestId('state-error')).toBeTruthy();
    });

    it('keeps the list switcher mounted', () => {
      const { getByTestId } = render(
        <ShoppingListMainContent screenData={withoutDetails()} />,
      );

      expect(getByTestId('list-selector')).toBeTruthy();
    });

    it('calls an unreachable server offline, not a failed load', () => {
      jest.mocked(useIsApiUnavailable).mockReturnValue(true);
      const { getByTestId, queryByTestId } = render(
        <ShoppingListMainContent screenData={withoutDetails()} />,
      );

      expect(getByTestId('state-offline')).toBeTruthy();
      expect(queryByTestId('state-error')).toBeNull();
      jest.mocked(useIsApiUnavailable).mockReturnValue(false);
    });

    it('does not tell the person they lack permission', () => {
      render(<ShoppingListMainContent screenData={withoutDetails()} />);

      const [[entry]] = jest.mocked(useTabBarAddMenu).mock.calls[0] ?? [[]];
      expect(entry?.disabledReason).not.toBe(
        t('shoppingListScreen.noAddPermission'),
      );
    });

    // An add Today handed over waits for the answer instead of showing it.
    it('marks the adds as waiting on the answer', () => {
      render(<ShoppingListMainContent screenData={withoutDetails()} />);

      const [entries] = jest.mocked(useTabBarAddMenu).mock.calls[0] ?? [[]];
      expect(entries.map(entry => entry.pending)).toEqual([true, true, true]);
    });

    it('waits rather than offering a retry while the answer is still coming', () => {
      const { queryByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            state: { currentListDetails: null, detailsLoading: true },
          })}
        />,
      );

      // The item queries settle before the detail one, so reading their flags
      // instead put this screen up for a frame on every visit to the tab.
      expect(queryByTestId('state-error')).toBeNull();
    });

    it('names the refusal once the answer is a known one', () => {
      (getShoppingListPermissionsWithOwner as jest.Mock).mockReturnValueOnce({
        canAddItems: false,
        canRemoveItems: false,
        canEditItems: false,
        canMarkPurchased: false,
      });

      render(<ShoppingListMainContent screenData={makeScreenData()} />);

      const [[entry]] = jest.mocked(useTabBarAddMenu).mock.calls[0] ?? [[]];
      expect(entry?.disabledReason).toBe(
        t('shoppingListScreen.noAddPermission'),
      );
      expect(entry?.pending).toBe(false);
    });
  });
});

describe('ShoppingListMainContent + menu', () => {
  const menu = () => jest.mocked(useTabBarAddMenu).mock.calls.at(-1)?.[0] ?? [];
  const entry = (key: string) => menu().find(action => action.key === key);

  it('offers search, barcode and manual adds, and no receipt', () => {
    render(<ShoppingListMainContent screenData={makeScreenData()} />);
    expect(menu().map(action => action.key)).toEqual([
      'search',
      'barcode',
      'manual',
    ]);
  });

  it('opens each flow directly for the active list', () => {
    render(<ShoppingListMainContent screenData={makeScreenData()} />);

    entry('search')?.onPress();
    expect(mockOpenAddItemSheet).toHaveBeenCalled();

    entry('barcode')?.onPress();
    expect(jest.mocked(useAppNavigation)().toBarcode).toHaveBeenCalledWith({
      source: 'shoppingList',
      shoppingListId: 'list-1',
    });

    entry('manual')?.onPress();
    expect(mockOpenAddItemManually).toHaveBeenCalled();
  });

  // The menu is where a member who may not add is told why.
  it("opens the same menu from an empty list's Add Item", () => {
    mockOpenAddItemSheet.mockClear();
    render(<ShoppingListMainContent screenData={makeScreenData()} />);

    mockEmptyState?.action?.onPress();

    expect(mockSetAddMenuOpen).toHaveBeenCalledWith(true);
    expect(mockOpenAddItemSheet).not.toHaveBeenCalled();
  });
});

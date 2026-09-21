'use no memo';

import React from 'react';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ShoppingListMainContent,
  type ShoppingListMainContentProps,
} from '#features/shoppingList/components/ShoppingListMainContent';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { useAnyShoppingListSheetVisible } from '#features/shoppingList/context/ShoppingListModalsContext';
import { useTabBarAddButton } from '#hooks/navigation/useTabBarAddButton';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { getShoppingListPermissionsWithOwner } from '#features/shoppingList/utils/shoppingListPermissions';
import * as selectorModalModule from '#features/shoppingList/hooks/useShoppingListSelectorModal';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useStore } from '#store';
import { userEvent } from '@testing-library/react-native';

type ScreenData = ShoppingListMainContentProps['screenData'];

const render = (ui: React.ReactElement) => renderWithApollo(ui);

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));

jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));

jest.mock('#hooks/useFeatureHint', () => ({
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

jest.mock('#features/shoppingList/hooks/useShoppingListSelectorModal', () => ({
  useShoppingListSelectorModal: jest.fn(() => ({
    selectorRef: { current: null },
    listConfig: {},
    handleOpenSelector: jest.fn(),
    handleOverlayOpen: jest.fn(),
    handleOverlayClose: jest.fn(),
  })),
}));

jest.mock('#features/shoppingList/hooks/useItemReordering', () => ({
  useItemReordering: jest.fn(() => ({
    handleSortOrderUpdate: jest.fn(),
  })),
}));

jest.mock('#hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: jest.fn(() => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  })),
}));

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: jest.fn(() => ({
    setOverlayOpen: jest.fn(),
    setScannerProps: jest.fn(),
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

jest.mock('#features/shoppingList/context/ShoppingListModalsContext', () => ({
  useShoppingListModalActions: jest.fn(() => ({
    openAddItemSheet: jest.fn(),
    openQuantityEdit: jest.fn(),
    openPurchaseAmount: jest.fn(),
    openMoveToPantry: jest.fn(),
  })),
  useAnyShoppingListSheetVisible: jest.fn(() => false),
}));

jest.mock('#features/shoppingList/context/ShoppingListTutorialContext', () => {
  const actual = jest.requireActual(
    '#features/shoppingList/context/ShoppingListTutorialContext',
  );
  return {
    ...actual,
    useShoppingListTutorial: jest.fn(() => null),
  };
});

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: { clearType: jest.fn() },
}));

jest.mock('#features/shoppingList/utils/shoppingListPermissions', () => ({
  getShoppingListPermissionsWithOwner: jest.fn(() => ({
    canAddItems: true,
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
  })),
}));

jest.mock('#/utils/finallyHelpers');

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

jest.mock('#features/shoppingList/components/ListTemplate', () => ({
  ListTemplate: () => null,
}));

jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({
    title,
    headerRight,
  }: {
    title: string;
    headerRight?: React.ReactNode;
  }) => (
    <>
      {title}
      {headerRight}
    </>
  ),
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
    SpotlightCoachMark: ({ title }: { title: string }) => {
      const { Text } = require('react-native');
      return <Text testID="spotlight-coach-mark">{title}</Text>;
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

// Full tutorial mock shape — every notify*/skip* fn the component may call,
// even though a given test only ever exercises the one matching its step.
const makeTutorial = (
  overrides: Partial<NonNullable<ReturnType<typeof useShoppingListTutorial>>>,
) => ({
  isActive: true,
  currentStep: ShoppingListTutorialStep.IDLE,
  rects: {},
  registerRect: jest.fn(),
  notifyAddButtonPressed: jest.fn(),
  notifyItemAdded: jest.fn(),
  notifySheetClosed: jest.fn(),
  notifySwipeActionsSeen: jest.fn(),
  notifyCheckboxTapped: jest.fn(),
  notifyLongPressPriceSeen: jest.fn(),
  notifyPurchasedTabTapped: jest.fn(),
  notifyMoveToPantryTapped: jest.fn(),
  skipCurrentStep: jest.fn(),
  skipAll: jest.fn(),
  ...overrides,
});

describe('ShoppingListMainContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useShoppingListTutorial as jest.Mock).mockReturnValue(null);
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

  it('renders with current list name', () => {
    const tree = render(
      <ShoppingListMainContent screenData={makeScreenData()} />,
    );
    expect(tree.toJSON()).toBeTruthy();
  });

  describe('tutorial coach-mark render guards', () => {
    // Positive control: proves the mocks/wiring actually let the coach mark
    // render at all, so the negative cases below are meaningful rather than
    // trivially passing because nothing was ever going to render.
    it('renders the coach mark when the step, rect, and item all line up', () => {
      (useShoppingListTutorial as jest.Mock).mockReturnValue(
        makeTutorial({
          currentStep: ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX,
          rects: { checkbox: { x: 0, y: 0, width: 10, height: 10 } },
        }),
      );
      const { getByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({
            rawUnpurchasedItems: [{ id: 'item-1' }],
          })}
        />,
      );
      expect(getByTestId('spotlight-coach-mark')).toBeTruthy();
    });

    it('hides the coach mark when the checkbox step has no unpurchased items, even with a stale rect', () => {
      (useShoppingListTutorial as jest.Mock).mockReturnValue(
        makeTutorial({
          currentStep: ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX,
          // Simulates a rect left over from before the last item was purchased/removed.
          rects: { checkbox: { x: 0, y: 0, width: 10, height: 10 } },
        }),
      );
      const { queryByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({ rawUnpurchasedItems: [] })}
        />,
      );
      expect(queryByTestId('spotlight-coach-mark')).toBeNull();
    });

    it('hides the coach mark when the move-to-pantry step has no purchased items', () => {
      (useShoppingListTutorial as jest.Mock).mockReturnValue(
        makeTutorial({
          currentStep: ShoppingListTutorialStep.SPOTLIGHT_MOVE_TO_PANTRY,
          rects: { archiveIcon: { x: 0, y: 0, width: 10, height: 10 } },
        }),
      );
      const { queryByTestId } = render(
        <ShoppingListMainContent
          screenData={makeScreenData({ rawPurchasedItems: [] })}
        />,
      );
      expect(queryByTestId('spotlight-coach-mark')).toBeNull();
    });

    it('hides the coach mark while the add-item sheet is open, even mid-way through an unrelated step', () => {
      (useShoppingListTutorial as jest.Mock).mockReturnValue(
        makeTutorial({
          currentStep: ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE,
          rects: { itemCard: { x: 0, y: 0, width: 10, height: 10 } },
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

    it('hides the coach mark while the purchase-amount sheet it opened is still open', () => {
      (useShoppingListTutorial as jest.Mock).mockReturnValue(
        makeTutorial({
          currentStep: ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE,
          rects: { itemCard: { x: 0, y: 0, width: 10, height: 10 } },
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
            '#features/shoppingList/hooks/useShoppingListSelectorModal',
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

      const [, , disabledCopy] = (useTabBarAddButton as jest.Mock).mock
        .calls[0];
      expect(disabledCopy).toBeUndefined();
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

      const [, , disabledCopy] = (useTabBarAddButton as jest.Mock).mock
        .calls[0];
      expect(disabledCopy).toBeTruthy();
    });
  });
});

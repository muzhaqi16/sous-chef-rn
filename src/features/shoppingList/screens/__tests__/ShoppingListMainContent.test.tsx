'use no memo';

import React from 'react';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ShoppingListMainContent,
  type ShoppingListMainContentProps,
} from '../ShoppingListMainContent';
import {
  useShoppingListTutorial,
  ShoppingListTutorialStep,
} from '#features/shoppingList/context/ShoppingListTutorialContext';
import { useShoppingListModals } from '#features/shoppingList/context/ShoppingListModalsContext';

type ScreenData = ShoppingListMainContentProps['screenData'];

const render = (ui: React.ReactElement) => renderWithApollo(ui);

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

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
  useShoppingListModals: jest.fn(() => ({
    addItemSheet: { open: jest.fn(), visible: false },
    quantityEdit: { openForItem: jest.fn(), visible: false },
    purchaseAmount: { openForItem: jest.fn(), visible: false },
    moveToPantry: { openForItem: jest.fn(), visible: false },
  })),
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

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn() },
}));

jest.mock('#/utils/permissions/shoppingListPermissions', () => ({
  getShoppingListPermissionsWithOwner: jest.fn(() => ({
    canAddItems: true,
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock(
  '#components/organisms/AnimatedItemSelector/AnimatedItemSelector',
  () => {
    const { forwardRef } = require('react');
    return { AnimatedItemSelector: forwardRef(() => null) };
  },
);

jest.mock('#components/templates/ListTemplate', () => ({
  ListTemplate: () => null,
}));

jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title }: { title: string }) => title,
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
  '#components/organisms/InteractiveSwipeHint/InteractiveSwipeHint',
  () => ({
    InteractiveSwipeHint: () => null,
  }),
);

jest.mock(
  '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark',
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
      currentListDetails: null,
      currentListId: 'list-1',
      selectedShoppingListId: 'list-1',
      unpurchasedItems: [],
      purchasedItems: [],
      rawUnpurchasedItems: [],
      rawPurchasedItems: [],
      isLoadingInitial: false,
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
      addItem: jest.fn(),
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
    (useShoppingListModals as jest.Mock).mockReturnValue({
      addItemSheet: { open: jest.fn(), visible: false },
      quantityEdit: { openForItem: jest.fn(), visible: false },
      purchaseAmount: { openForItem: jest.fn(), visible: false },
      moveToPantry: { openForItem: jest.fn(), visible: false },
    });
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
      (useShoppingListModals as jest.Mock).mockReturnValue({
        addItemSheet: { open: jest.fn(), visible: true },
        quantityEdit: { openForItem: jest.fn(), visible: false },
        purchaseAmount: { openForItem: jest.fn(), visible: false },
        moveToPantry: { openForItem: jest.fn(), visible: false },
      });
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
      (useShoppingListModals as jest.Mock).mockReturnValue({
        addItemSheet: { open: jest.fn(), visible: false },
        quantityEdit: { openForItem: jest.fn(), visible: false },
        purchaseAmount: { openForItem: jest.fn(), visible: true },
        moveToPantry: { openForItem: jest.fn(), visible: false },
      });
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
});

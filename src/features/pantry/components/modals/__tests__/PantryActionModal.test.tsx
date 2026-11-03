import React from 'react';
import type { ViewProps } from 'react-native';
import { screen, userEvent } from '@testing-library/react-native';
import { PantryActionModal } from '#features/pantry/components/modals/PantryActionModal';
import type { PantryActionModal_PantryItemFragment } from '../PantryActionModal.generated';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import {
  recordMock,
  renderWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { t } from '#/i18n';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { GetPantryActionItemDocument } from '#features/pantry/components/modals/PantryActionModal.generated';
import { PantryActionModal_PantryItemFragmentDoc } from '#features/pantry/components/modals/PantryActionModal.generated';
import type { PantryActionSharedState } from '#features/pantry/types';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { unitLabel } from '#/utils/formatQuantity';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        surface: '#FFF',
        white: '#FFF',
      },
    },
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/BottomSheetKeyboardAwareScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetKeyboardAwareScrollView: (props: ViewProps) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/molecules/BottomSheetHeader', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BottomSheetHeader: ({
      title,
      onCancel,
      onConfirm,
      confirmLabel,
    }: {
      title: string;
      onCancel: () => void;
      onConfirm: () => void;
      confirmLabel?: string;
    }) =>
      R.createElement(
        RN.View,
        { testID: 'bottom-sheet-header' },
        R.createElement(RN.Text, null, title),
        R.createElement(
          RN.Pressable,
          { onPress: onCancel, testID: 'cancel-button' },
          R.createElement(RN.Text, null, 'Cancel'),
        ),
        R.createElement(
          RN.Pressable,
          { onPress: onConfirm, testID: 'confirm-button' },
          R.createElement(RN.Text, null, confirmLabel),
        ),
      ),
  };
});

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    bottomSheetScrollView: {},
    bottomSheetContent: {},
    bottomSheetItemInfo: {},
    bottomSheetItemName: {},
    bottomSheetItemRow: {},
    bottomSheetItemLabel: {},
    bottomSheetSection: {},
    bottomSheetSectionLabel: {},
    bottomSheetOptionContainer: {},
    bottomSheetOption: {},
    bottomSheetOptionSelected: {},
    bottomSheetOptionText: {},
    bottomSheetOptionTextSelected: {},
  },
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const mockNoUnits = {
  groups: [],
  allUnits: [],
  defaultUnit: null,
  defaultIncrement: null,
  defaultCommonFractions: null,
  loading: false,
};
const mockUseOperationUnits = jest.fn(() => mockNoUnits);
jest.mock('#features/pantry/hooks/useOperationUnits', () => ({
  ...jest.requireActual('#features/pantry/hooks/useOperationUnits'),
  useOperationUnits: () => mockUseOperationUnits(),
}));

jest.mock('#features/pantry/hooks/useConvertAvailableQuantity', () => ({
  useConvertAvailableQuantity: jest.fn(() => ({
    availableInSelectedUnit: null,
    availableLoading: false,
  })),
}));

jest.mock('#features/pantry/components/UnitPicker', () => ({
  UnitPicker: () => null,
}));

const PANTRY_ITEM_ID = 'pantry-1';

function makeCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      // The production selection the consumer reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: PantryActionModal_PantryItemFragmentDoc,
      data: {
        __typename: 'PantryItem',
        id: PANTRY_ITEM_ID,
        version: 1,
        itemId: 'item-1',
        itemName: 'Flour',
        quantity: 5,
        heldQuantity: 5,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 5 },
        displayAmount: {
          __typename: 'DisplayAmount',
          quantity: 5,
          localizedSymbol: 'lbs',
          fraction: null,
          unit: asAbbreviation({ __typename: 'Unit', id: 'u1', symbol: 'lbs' }),
        },
        activeBatchCount: 1,
        netWeight: null,
        remainingNetWeight: null,
        portionUnitId: null,
        portionUnit: null,
        remainingPortions: null,
        lastUsedAt: null,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'u1',
          symbol: 'lbs',
          name: 'Pounds',
          type: 'WEIGHT',
          displayAsFraction: false,
        }),
        displayUnit: null,
        netWeightUnit: null,
        consumeUnit: null,
        packageBreakdown: null,
        quantityBreakdown: null,
        ...overrides,
      },
    },
  ]);
}

describe('PantryActionModal', () => {
  const mockRenderActionFields = jest.fn<
    React.ReactNode,
    [PantryActionSharedState, PantryActionModal_PantryItemFragment]
  >(() => {
    const RN = require('react-native');
    return require('react').createElement(
      RN.Text,
      { testID: 'action-fields' },
      'Action Fields',
    );
  });

  const defaultProps = {
    visible: true,
    pantryItemId: PANTRY_ITEM_ID,
    onClose: jest.fn(),
    title: 'Test Action',
    confirmLabel: 'Confirm',
    operation: PantryOperation.Consume,
    onConfirm: jest.fn(),
    renderActionFields: mockRenderActionFields,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOperationUnits.mockReturnValue(mockNoUnits);
  });

  describe('an item it cannot read', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('offers to read it again rather than opening empty', async () => {
      const failed = recordMock(GetPantryActionItemDocument, {
        error: new Error('network down'),
      });
      renderWithApollo(<PantryActionModal {...defaultProps} />, {
        operationMocks: [failed.mock],
      });

      await drainTimers();
      expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();

      await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
      await drainTimers();
      expect(failed.fired).toHaveLength(2);
    });

    it('keeps the item the device holds when the read fails', async () => {
      const failed = recordMock(GetPantryActionItemDocument, {
        error: new Error('network down'),
      });
      renderWithApollo(<PantryActionModal {...defaultProps} />, {
        cache: makeCache(),
        operationMocks: [failed.mock],
      });

      await drainTimers();
      expect(screen.getByText('Flour')).toBeTruthy();
      expect(screen.queryByText(t('dataState.errorTitle'))).toBeNull();
    });
  });

  it('renders with the provided title', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Test Action')).toBeTruthy();
  });

  it('displays item name', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Flour')).toBeTruthy();
  });

  it('renders action fields via renderActionFields prop', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Action Fields')).toBeTruthy();
    expect(mockRenderActionFields).toHaveBeenCalled();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    await user.press(screen.getByTestId('cancel-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    await user.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('does not render item info when pantryItemId is null', () => {
    renderWithApollo(
      <PantryActionModal {...defaultProps} pantryItemId={null} />,
      { cache: makeCache() },
    );
    expect(screen.queryByText('Flour')).toBeNull();
  });

  it('renders confirm button with correct label', () => {
    renderWithApollo(
      <PantryActionModal {...defaultProps} confirmLabel="Do it" />,
      { cache: makeCache() },
    );
    expect(screen.getByText('Do it')).toBeTruthy();
  });

  it('passes correct trackingQuantity to renderActionFields', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    const shared = mockRenderActionFields.mock.calls[0]![0];
    expect(shared.trackingQuantity).toBe(5);
    expect(unitLabel(shared.activeUnit)).toBe('lbs');
  });

  it('passes trackingUnitId to renderActionFields', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    const shared = mockRenderActionFields.mock.calls[0]![0];
    expect(shared.trackingUnitId).toBe('u1');
  });

  // A row created offline holds a neutral unit with an empty id. Passed on as
  // the unit a consume is measured in, it becomes an explicit `usageUnitId`
  // that names nothing; omitted, the server uses the stack's own unit.
  it('names no unit for a row whose unit is still the offline placeholder', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache({
        unit: asAbbreviation({
          __typename: 'Unit',
          id: '',
          symbol: '',
          name: '',
          type: 'COUNT',
          displayAsFraction: false,
        }),
        displayAmount: {
          __typename: 'DisplayAmount',
          quantity: 5,
          localizedSymbol: '',
          fraction: null,
          unit: asAbbreviation({ __typename: 'Unit', id: '', symbol: '' }),
        },
      }),
    });

    await user.press(screen.getByTestId('confirm-button'));
    const shared = defaultProps.onConfirm.mock.calls[0][0];
    expect(shared.trackingUnitId).toBeUndefined();
    expect(shared.activeUnitId).toBeUndefined();
  });

  it('returns 0 for trackingQuantity when pantryItemId is null', async () => {
    const user = userEvent.setup();
    renderWithApollo(
      <PantryActionModal {...defaultProps} pantryItemId={null} />,
      { cache: makeCache() },
    );
    await user.press(screen.getByTestId('confirm-button'));
    const shared = defaultProps.onConfirm.mock.calls[0][0];
    expect(shared.trackingQuantity).toBe(0);
  });

  it('resets notes when modal opens with new pantryItem', () => {
    const cache = makeCache();
    const { rerender } = renderWithApollo(
      <PantryActionModal
        {...defaultProps}
        visible={false}
        pantryItemId={null}
      />,
      { cache },
    );
    rerender(
      <PantryActionModal
        {...defaultProps}
        visible={true}
        pantryItemId={PANTRY_ITEM_ID}
      />,
    );
    const shared =
      mockRenderActionFields.mock.calls[
        mockRenderActionFields.mock.calls.length - 1
      ]![0];
    expect(shared.notes).toBe('');
  });

  it('calls onReset when modal opens', () => {
    const onReset = jest.fn();
    const cache = makeCache();
    const { rerender } = renderWithApollo(
      <PantryActionModal
        {...defaultProps}
        visible={false}
        pantryItemId={null}
        onReset={onReset}
      />,
      { cache },
    );
    rerender(
      <PantryActionModal
        {...defaultProps}
        visible={true}
        pantryItemId={PANTRY_ITEM_ID}
        onReset={onReset}
      />,
    );
    expect(onReset).toHaveBeenCalledWith(expect.any(Object), null, null);
  });

  it('says what is left as the row does, with nothing beside it', () => {
    const reading = {
      __typename: 'MeasureReading',
      value: 9,
      unitId: 'can',
      symbol: 'cans',
      localizedSymbol: 'cans',
      displayAsFraction: false,
      type: 'COUNT',
    };
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache({
        remainingNetWeight: 67.5,
        amountLeft: {
          __typename: 'Measure',
          value: 9,
          unitId: 'can',
          metric: reading,
          imperial: reading,
        },
      }),
    });

    expect(screen.getByText('9 cans')).toBeTruthy();
    expect(screen.queryByText(/remaining/)).toBeNull();
  });

  it('reads what a part-used case comes to by the can', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache({
        quantity: 1.6,
        heldQuantity: 1.6,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 1 },
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'case',
          name: 'case',
          symbol: 'case',
          type: UnitType.Count,
          displayAsFraction: false,
          commonFractions: null,
        }),
        portionUnitId: 'can',
        portionUnit: asAbbreviation({
          __typename: 'Unit',
          id: 'can',
          name: 'can',
          symbol: 'cans',
        }),
        portionsPerTrackingUnit: 10,
        remainingPortions: 16,
      }),
    });

    const shared = mockRenderActionFields.mock.calls.at(-1)![0];
    expect(shared.leftAfter(-1)).toMatchObject({
      quantity: 26,
      unit: { symbol: 'cans' },
    });
  });

  it('previews what two opened cases hold by the can, never as a whole case', () => {
    // 0.7 and 0.8 of a case: half a case drawn leaves one case's worth.
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache({
        quantity: 2,
        heldQuantity: 1.5,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 0 },
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'case',
          name: 'case',
          symbol: 'case',
          type: UnitType.Count,
          displayAsFraction: false,
          commonFractions: null,
        }),
        portionUnitId: 'can',
        portionUnit: asAbbreviation({
          __typename: 'Unit',
          id: 'can',
          name: 'can',
          symbol: 'cans',
        }),
        portionsPerTrackingUnit: 10,
        remainingPortions: 15,
      }),
    });

    const shared = mockRenderActionFields.mock.calls.at(-1)![0];
    expect(shared.leftAfter(0.5)).toMatchObject({
      quantity: 10,
      unit: { symbol: 'cans' },
    });
  });

  describe('on a stack stating what a package holds', () => {
    const counted = (id: string) =>
      asAbbreviation({
        __typename: 'Unit',
        id,
        name: id,
        symbol: id,
        type: UnitType.Count,
        displayAsFraction: false,
        commonFractions: null,
      });
    const measured = (id: string, symbol: string) =>
      asAbbreviation({ __typename: 'Unit', id, name: symbol, symbol });

    it('previews a can drawn from a pack that states its volume by the can', () => {
      renderWithApollo(<PantryActionModal {...defaultProps} />, {
        cache: makeCache({
          quantity: 1,
          heldQuantity: 1,
          stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 1 },
          unit: counted('pack'),
          portionUnitId: 'can',
          portionUnit: measured('can', 'cans'),
          portionsPerTrackingUnit: 10,
          remainingPortions: 10,
          netWeight: 2000,
          remainingNetWeight: 2000,
          netWeightUnit: measured('ml', 'mL'),
        }),
      });

      const shared = mockRenderActionFields.mock.calls.at(-1)![0];
      expect(shared.packagesOfNetWeight(200)).toBe(0.1);
      expect(shared.leftAfter(0.1)).toMatchObject({
        quantity: 9,
        unit: { symbol: 'cans' },
      });
    });

    it('previews what a bag drawn by weight leaves in the weight, not a part of a bag', () => {
      renderWithApollo(<PantryActionModal {...defaultProps} />, {
        cache: makeCache({
          quantity: 1,
          heldQuantity: 1,
          stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 1 },
          unit: counted('bag'),
          netWeight: 5,
          remainingNetWeight: 5,
          netWeightUnit: measured('lb', 'lb'),
        }),
      });

      const shared = mockRenderActionFields.mock.calls.at(-1)![0];
      expect(shared.leftAfter(0.8)).toMatchObject({
        quantity: 1,
        unit: { symbol: 'lb' },
      });
    });
  });

  describe('on a stack of pieces shown in dozens', () => {
    const eggs = {
      itemName: 'Eggs',
      quantity: 36,
      heldQuantity: 36,
      stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 36 },
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity: 3,
        localizedSymbol: 'doz',
        fraction: null,
        unit: asAbbreviation({ __typename: 'Unit', id: 'doz', symbol: 'doz' }),
      },
      unit: asAbbreviation({
        __typename: 'Unit',
        id: 'pc',
        symbol: 'pc',
        name: 'piece',
        type: 'COUNT',
        displayAsFraction: false,
      }),
      displayUnit: asAbbreviation({
        __typename: 'Unit',
        id: 'doz',
        symbol: 'doz',
        type: 'COUNT',
        hasStandardCountFactor: true,
        baseUnitId: 'pc',
        conversionFactor: 12,
        commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
      }),
    };
    const dozen = {
      unitId: 'doz',
      unit: { symbol: 'doz', name: 'dozen' },
      unitType: 'COUNT',
      isTrackingUnit: false,
      countFactor: 12,
      conversionRatio: null,
      conversionConfidence: null,
    };

    const renderedState = () => {
      renderWithApollo(<PantryActionModal {...defaultProps} />, {
        cache: makeCache(eggs),
      });
      return mockRenderActionFields.mock.calls.at(-1)![0];
    };

    it('shows a held amount as the stack does', () => {
      const shared = renderedState();
      expect(shared.leftAfter(12)).toEqual({
        quantity: 2,
        unit: expect.objectContaining({ symbol: 'doz' }),
        displayAsFraction: null,
      });
      expect(shared.leftAfter(25)).toEqual({
        quantity: 11,
        unit: expect.objectContaining({ symbol: 'pc' }),
        displayAsFraction: false,
      });
    });

    it('needs no conversion in pieces', () => {
      expect(renderedState().exactFactor).toBe(1);
    });

    it('needs no conversion in dozens, which count 12 pieces each', () => {
      const { rerender } = renderWithApollo(
        <PantryActionModal {...defaultProps} />,
        { cache: makeCache(eggs) },
      );
      // The ranked units arrive after the first render; the dozen leads them.
      mockUseOperationUnits.mockReturnValue({
        ...mockNoUnits,
        allUnits: [dozen],
        defaultUnit: dozen,
      } as never);
      rerender(<PantryActionModal {...defaultProps} />);
      expect(mockRenderActionFields.mock.calls.at(-1)![0].exactFactor).toBe(12);
    });

    it('selects the default unit when it opens over cached units', () => {
      mockUseOperationUnits.mockReturnValue({
        ...mockNoUnits,
        allUnits: [dozen],
        defaultUnit: dozen,
      } as never);
      renderWithApollo(<PantryActionModal {...defaultProps} />, {
        cache: makeCache(eggs),
      });

      const shared = mockRenderActionFields.mock.calls.at(-1)![0];
      expect(shared.selectedUnitInfo).toBe(dozen);
      expect(shared.activeUnitId).toBe('doz');
    });

    it('converts on a dual-tracked stack, whose count moves by whole packages', () => {
      const { rerender } = renderWithApollo(
        <PantryActionModal {...defaultProps} />,
        {
          cache: makeCache({
            ...eggs,
            netWeight: 50,
            netWeightUnit: asAbbreviation({
              __typename: 'Unit',
              id: 'g',
              name: 'gram',
              symbol: 'g',
            }),
          }),
        },
      );
      mockUseOperationUnits.mockReturnValue({
        ...mockNoUnits,
        allUnits: [dozen],
        defaultUnit: dozen,
      } as never);
      rerender(<PantryActionModal {...defaultProps} />);
      const shared = mockRenderActionFields.mock.calls.at(-1)![0];
      expect(shared.activeUnitId).toBe('doz');
      expect(shared.exactFactor).toBeNull();
    });
  });
});

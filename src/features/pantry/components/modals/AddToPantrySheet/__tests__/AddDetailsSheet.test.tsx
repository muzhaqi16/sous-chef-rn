'use no memo';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { AddDetailsSheet } from '../AddDetailsSheet';
import type { StoragePageProps } from '../StoragePage';
import type { StorageState as StorageStateType } from '#/graphql/generated/schemaTypes';
import { drainTimers } from '#/test-utils/drainTimers';
import { requirePlatform } from '#platform/install';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';

type PagerViewMockProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};
type PagerViewMockRef = React.Ref<{ setPage: (page: number) => void }>;

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

jest.mock('react-native-pager-view', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: R.forwardRef(
      ({ children, style }: PagerViewMockProps, ref: PagerViewMockRef) => {
        R.useImperativeHandle(ref, () => ({
          setPage: jest.fn(),
        }));
        return <View style={style}>{children}</View>;
      },
    ),
  };
});

jest.mock('#features/pantry/hooks/usePantryItemSubmission', () => ({
  usePantryItemSubmission: jest.fn(() => ({
    handleConfirm: jest.fn(),
    loading: false,
  })),
}));

const mockFocusItemName = jest.fn();

// Stands in for Item Name's input: react-hook-form focuses a field through the
// ref its `Controller` hands out, so this is what a failed submit reaches.
function MockFocusProbe({ ref }: { ref: React.Ref<{ focus: () => void }> }) {
  const { useImperativeHandle } = require('react');
  useImperativeHandle(ref, () => ({ focus: mockFocusItemName }));
  return null;
}

jest.mock('../MainDetailsPage', () => ({
  // Renders the name field through the sheet's own `control`, so the contract
  // with the page (a validation failure reaches the field, and focus can) is
  // assertable here. Whether the page paints the message is FormInput's test.
  MainDetailsPage: ({
    control,
    storageState,
  }: {
    control: import('react-hook-form').Control<
      import('#features/pantry/types').AddPantryItemFormData
    >;
    storageState: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    const { Controller } = require('react-hook-form');
    return (
      <View testID="main-details-page">
        <Text>Main Details Page</Text>
        <Controller
          control={control}
          name="itemName"
          render={({
            field,
            fieldState,
          }: {
            field: {
              onChange: (value: string) => void;
              ref: React.Ref<{ focus: () => void }>;
            };
            fieldState: { error?: { message?: string } };
          }) => (
            <>
              <MockFocusProbe ref={field.ref} />
              <Pressable
                testID="main-details-page-type-name"
                onPress={() => field.onChange('Milk')}
              />
              {fieldState.error ? (
                <Text testID="main-details-page-name-error">
                  {fieldState.error.message}
                </Text>
              ) : null}
            </>
          )}
        />
        <Text testID="main-details-page-storage-state">{storageState}</Text>
      </View>
    );
  },
}));

jest.mock('../DetailsPage', () => ({
  // Exposes what one package holds: the rule on its unit reads the size and
  // the resolved unit id, so only a test that writes both can see it clear.
  DetailsPage: ({
    setSizeInput,
    handleSizeUnitSelected,
    sizeUnitError,
  }: {
    setSizeInput: (value: string) => void;
    handleSizeUnitSelected: (
      unitId: string | null,
      unitName: string | null,
    ) => void;
    sizeUnitError?: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="details-page">
        <Text>Details Page</Text>
        <Pressable testID="type-size" onPress={() => setSizeInput('500')}>
          <Text>Type size</Text>
        </Pressable>
        <Pressable
          testID="pick-size-unit"
          onPress={() => handleSizeUnitSelected('unit-g', 'g')}
        >
          <Text>Pick unit</Text>
        </Pressable>
        <Pressable
          testID="type-size-unit"
          onPress={() => handleSizeUnitSelected(null, 'ca')}
        >
          <Text>Type unit</Text>
        </Pressable>
        {sizeUnitError ? (
          <Text testID="details-page-unit-error">{sizeUnitError}</Text>
        ) : null}
      </View>
    );
  },
}));

jest.mock('../StoragePage', () => ({
  // Picks a location the way the autocomplete does: its id, then the option.
  StoragePage: ({
    handleStorageLocationSelected,
  }: Pick<StoragePageProps, 'handleStorageLocationSelected'>) => {
    const { View, Text, Pressable } = require('react-native');
    const {
      StorageState,
      StorageType,
    } = require('#/graphql/generated/schemaTypes');
    const pick = (id: string, temperature: StorageStateType | null) =>
      handleStorageLocationSelected(id, {
        id,
        name: id,
        type: StorageType.Freezer,
        isDefault: false,
        temperature,
      });
    return (
      <View testID="storage-page">
        <Text>Storage Page</Text>
        <Pressable
          testID="pick-frozen-location"
          onPress={() => pick('loc-freezer', StorageState.Frozen)}
        >
          <Text>Pick freezer</Text>
        </Pressable>
        <Pressable
          testID="pick-unrated-location"
          onPress={() => pick('loc-shelf', StorageState.None)}
        >
          <Text>Pick shelf</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../StockSettingsPage', () => ({
  StockSettingsPage: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="stock-settings-page">
        <Text>Stock Settings Page</Text>
      </View>
    );
  },
}));

const defaultProps = {
  visible: true,
  pantryId: 'pantry-1',
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AddDetailsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<AddDetailsSheet {...defaultProps} />);
    expect(screen.getByText('Add Item Details')).toBeTruthy();
  });

  it('renders the Cancel button', () => {
    render(<AddDetailsSheet {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders the Add/save button', () => {
    render(<AddDetailsSheet {...defaultProps} />);
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('shows Adding... when loading', () => {
    const usePantryItemSubmission =
      require('#features/pantry/hooks/usePantryItemSubmission').usePantryItemSubmission;
    // `mockReturnValue`, not `…Once`: the form re-renders more than once now
    // that react-hook-form owns its state, and a one-shot mock would be
    // consumed by the first render and report `loading: false` thereafter.
    usePantryItemSubmission.mockReturnValue({
      handleConfirm: jest.fn(),
      loading: true,
    });
    render(<AddDetailsSheet {...defaultProps} />);
    expect(screen.getByText('Adding...')).toBeTruthy();
  });

  it('renders page indicator labels', () => {
    render(<AddDetailsSheet {...defaultProps} />);
    expect(screen.getByText('Main')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Stock')).toBeTruthy();
  });

  it('renders all pages', () => {
    render(<AddDetailsSheet {...defaultProps} />);
    expect(screen.getByTestId('main-details-page')).toBeTruthy();
    expect(screen.getByTestId('details-page')).toBeTruthy();
    expect(screen.getByTestId('storage-page')).toBeTruthy();
    expect(screen.getByTestId('stock-settings-page')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);
    await user.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does NOT submit an empty form, and says so on the name field', async () => {
    // The item name is required. It reports as a field message rather than an
    // alert covering the form, and `handleSubmit` gates the mutation on it.
    const user = userEvent.setup();
    const mockHandleConfirm = jest.fn();
    const usePantryItemSubmission =
      require('#features/pantry/hooks/usePantryItemSubmission').usePantryItemSubmission;
    usePantryItemSubmission.mockReturnValue({
      handleConfirm: mockHandleConfirm,
      loading: false,
    });

    render(<AddDetailsSheet {...defaultProps} />);
    await user.press(screen.getByTestId('add-pantry-item-submit-button'));

    expect(mockHandleConfirm).not.toHaveBeenCalled();
    await drainTimers();
    expect(
      screen.getByTestId('main-details-page-name-error'),
    ).toHaveTextContent('Please enter an item name');
  });

  it('focuses Item Name on an empty submit and speaks its message', async () => {
    const user = userEvent.setup();
    const announce = jest.spyOn(requirePlatform('screenReader'), 'announce');
    mockFocusItemName.mockClear();

    render(<AddDetailsSheet {...defaultProps} />);
    await user.press(screen.getByTestId('add-pantry-item-submit-button'));
    await drainTimers();

    expect(mockFocusItemName).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('Please enter an item name');
    announce.mockRestore();
  });

  describe('Cancel', () => {
    it('closes an untouched form at once', async () => {
      const user = userEvent.setup();
      const alert = jest.spyOn(alertService, 'alert');
      const onClose = jest.fn();

      render(<AddDetailsSheet {...defaultProps} onClose={onClose} />);
      await user.press(screen.getByTestId('add-pantry-item-cancel-button'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(alert).not.toHaveBeenCalled();
      alert.mockRestore();
    });

    it('asks before dropping what was typed, and holds the sheet open', async () => {
      const user = userEvent.setup();
      const alert = jest.spyOn(alertService, 'alert');
      const onClose = jest.fn();
      const onHoldOpen = jest.fn();

      render(
        <AddDetailsSheet
          {...defaultProps}
          onClose={onClose}
          onHoldOpen={onHoldOpen}
        />,
      );
      await user.press(screen.getByTestId('main-details-page-type-name'));
      await drainTimers();
      await user.press(screen.getByTestId('add-pantry-item-cancel-button'));

      expect(onHoldOpen).toHaveBeenLastCalledWith(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith(
        t('confirmations.discardChangesTitle'),
        t('confirmations.discardChanges'),
        expect.any(Array),
      );
      alert.mockRestore();
    });
  });

  it('submits once the required fields are filled', async () => {
    const user = userEvent.setup();
    const mockHandleConfirm = jest.fn();
    const usePantryItemSubmission =
      require('#features/pantry/hooks/usePantryItemSubmission').usePantryItemSubmission;
    usePantryItemSubmission.mockReturnValue({
      handleConfirm: mockHandleConfirm,
      loading: false,
    });

    render(<AddDetailsSheet {...defaultProps} prefilledItemName="Olive Oil" />);
    await user.press(screen.getByTestId('add-pantry-item-submit-button'));

    await drainTimers();
    expect(mockHandleConfirm).toHaveBeenCalled();
  });

  it('uses prefilledItemName when provided', () => {
    render(
      <AddDetailsSheet {...defaultProps} prefilledItemName="Preloaded Item" />,
    );
    expect(screen.getByText('Add Item Details')).toBeTruthy();
  });
});

describe('AddDetailsSheet — what one package holds', () => {
  it('reports a size typed with no unit on the unit field', async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);

    await user.press(screen.getByTestId('type-size'));
    await user.press(screen.getByTestId('add-pantry-item-submit-button'));

    await drainTimers();
    expect(screen.getByTestId('details-page-unit-error')).toHaveTextContent(
      'Pick the size’s unit from the list.',
    );
  });

  it('says nothing while the unit is still to come', async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);

    await user.press(screen.getByTestId('type-size'));

    await drainTimers();
    expect(screen.queryByTestId('details-page-unit-error')).toBeNull();
  });

  it('says nothing while the unit is being typed', async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);

    await user.press(screen.getByTestId('type-size'));
    await user.press(screen.getByTestId('type-size-unit'));

    await drainTimers();
    expect(screen.queryByTestId('details-page-unit-error')).toBeNull();
  });

  it('clears that message once a unit is picked', async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);

    await user.press(screen.getByTestId('type-size'));
    await user.press(screen.getByTestId('add-pantry-item-submit-button'));
    await drainTimers();
    expect(screen.getByTestId('details-page-unit-error')).toBeTruthy();

    await user.press(screen.getByTestId('pick-size-unit'));

    await drainTimers();
    expect(screen.queryByTestId('details-page-unit-error')).toBeNull();
  });
});

describe('AddDetailsSheet — a picked location seeds the storage state', () => {
  it("takes the location's temperature", async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);
    expect(
      screen.getByTestId('main-details-page-storage-state'),
    ).toHaveTextContent('AMBIENT');

    await user.press(screen.getByTestId('pick-frozen-location'));

    await drainTimers();
    expect(
      screen.getByTestId('main-details-page-storage-state'),
    ).toHaveTextContent('FROZEN');
  });

  it('leaves the chosen state alone for a location with no temperature control', async () => {
    const user = userEvent.setup();
    render(<AddDetailsSheet {...defaultProps} />);

    await user.press(screen.getByTestId('pick-frozen-location'));
    await user.press(screen.getByTestId('pick-unrated-location'));

    await drainTimers();
    expect(
      screen.getByTestId('main-details-page-storage-state'),
    ).toHaveTextContent('FROZEN');
  });
});

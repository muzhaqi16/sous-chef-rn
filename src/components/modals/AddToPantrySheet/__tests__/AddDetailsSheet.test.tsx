'use no memo';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { AddDetailsSheet } from '../AddDetailsSheet';

type PagerViewMockProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};
type PagerViewMockRef = React.Ref<{ setPage: (page: number) => void }>;

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('#/utils/iconUtils', () => ({
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

jest.mock('../MainDetailsPage', () => ({
  // Renders `itemNameError` so the sheet's contract with the page — that a
  // validation failure reaches the field — is assertable here. Whether the
  // page paints it as a red border is FormInput's own test.
  MainDetailsPage: ({ itemNameError }: { itemNameError?: string }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="main-details-page">
        <Text>Main Details Page</Text>
        {itemNameError ? (
          <Text testID="main-details-page-name-error">{itemNameError}</Text>
        ) : null}
      </View>
    );
  },
}));

jest.mock('../DetailsPage', () => ({
  DetailsPage: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="details-page">
        <Text>Details Page</Text>
      </View>
    );
  },
}));

jest.mock('../StoragePage', () => ({
  StoragePage: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="storage-page">
        <Text>Storage Page</Text>
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
    // The item name is required. This used to be an `alertService.alert` that
    // covered the form; it is a field message now, and `handleSubmit` gates
    // the mutation on it.
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
    expect(
      await screen.findByTestId('main-details-page-name-error'),
    ).toHaveTextContent('Please enter an item name');
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

    await waitFor(() => expect(mockHandleConfirm).toHaveBeenCalled());
  });

  it('uses prefilledItemName when provided', () => {
    render(
      <AddDetailsSheet {...defaultProps} prefilledItemName="Preloaded Item" />,
    );
    expect(screen.getByText('Add Item Details')).toBeTruthy();
  });
});

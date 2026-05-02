'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AddDetailsSheet } from '../AddDetailsSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  })),
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('react-native-pager-view', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: R.forwardRef(({ children, style }: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        setPage: jest.fn(),
      }));
      return <View style={style}>{children}</View>;
    }),
  };
});

jest.mock('#hooks/pantry/usePantryItemSubmission', () => ({
  usePantryItemSubmission: jest.fn(() => ({
    handleConfirm: jest.fn(),
    loading: false,
  })),
}));

jest.mock('../MainDetailsPage', () => ({
  MainDetailsPage: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="main-details-page">
        <Text>Main Details Page</Text>
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
      require('#hooks/pantry/usePantryItemSubmission').usePantryItemSubmission;
    usePantryItemSubmission.mockReturnValueOnce({
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

  it('calls onClose when Cancel is pressed', () => {
    render(<AddDetailsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls handleConfirm when Add is pressed', () => {
    const mockHandleConfirm = jest.fn();
    const usePantryItemSubmission =
      require('#hooks/pantry/usePantryItemSubmission').usePantryItemSubmission;
    usePantryItemSubmission.mockReturnValueOnce({
      handleConfirm: mockHandleConfirm,
      loading: false,
    });
    render(<AddDetailsSheet {...defaultProps} />);
    fireEvent.press(screen.getByTestId('add-pantry-item-submit-button'));
    expect(mockHandleConfirm).toHaveBeenCalled();
  });

  it('uses prefilledItemName when provided', () => {
    render(
      <AddDetailsSheet {...defaultProps} prefilledItemName="Preloaded Item" />,
    );
    expect(screen.getByText('Add Item Details')).toBeTruthy();
  });
});

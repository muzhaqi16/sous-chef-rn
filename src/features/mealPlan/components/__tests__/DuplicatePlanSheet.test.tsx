'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { DuplicatePlanSheet } from '../DuplicatePlanSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: any) => children,
}));

jest.mock('#components/atoms/BottomSheetFormScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetFormScrollView: (props: any) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/atoms/BottomSheetHeader', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BottomSheetHeader: ({
      title,
      onCancel,
      onConfirm,
      confirmLabel,
      confirmDisabled,
    }: any) =>
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
          {
            onPress: onConfirm,
            testID: 'confirm-button',
            disabled: confirmDisabled,
          },
          R.createElement(RN.Text, null, confirmLabel),
        ),
      ),
  };
});

jest.mock('#components/molecules/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({ label, value, onChangeText, placeholder }: any) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          value,
          onChangeText,
          placeholder,
          testID: `form-input-${label?.replace(/\s+/g, '-').toLowerCase()}`,
        }),
      ),
  };
});

jest.mock('#utils/iconUtils', () => ({
  Icon: (props: any) => {
    const RN = require('react-native');
    return require('react').createElement(
      RN.Text,
      { testID: `icon-${props.name}` },
      props.name,
    );
  },
}));

describe('DuplicatePlanSheet', () => {
  const mockMealPlan = {
    id: 'mp-1',
    name: 'Weekly Plan',
    startDate: '2025-03-01T00:00:00.000Z',
    endDate: '2025-03-07T00:00:00.000Z',
    __typename: 'MealPlan',
  };

  const defaultProps = {
    visible: true,
    mealPlan: mockMealPlan as any,
    onClose: jest.fn(),
    onDuplicate: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the sheet title', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(screen.getByText('Duplicate Plan')).toBeTruthy();
  });

  it('renders the New Plan Name input', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(screen.getByText('New Plan Name')).toBeTruthy();
  });

  it('renders Start Date label', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(screen.getByText('Start Date')).toBeTruthy();
  });

  it('renders info card text about meal copying', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(
      screen.getByText(
        'All meals will be copied to the new date range with the same structure.',
      ),
    ).toBeTruthy();
  });

  it('renders Current Plan section when mealPlan is provided', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(screen.getByText('Current Plan')).toBeTruthy();
  });

  it('does not render Current Plan section when mealPlan is null', () => {
    render(<DuplicatePlanSheet {...defaultProps} mealPlan={null} />);
    expect(screen.queryByText('Current Plan')).toBeNull();
  });

  it('shows Duplicating... label when loading', () => {
    render(<DuplicatePlanSheet {...defaultProps} loading={true} />);
    expect(screen.getByText('Duplicating...')).toBeTruthy();
  });

  it('shows Duplicate label when not loading', () => {
    render(<DuplicatePlanSheet {...defaultProps} loading={false} />);
    expect(screen.getByText('Duplicate')).toBeTruthy();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} />);
    await user.press(screen.getByTestId('cancel-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onDuplicate with correct data when confirm is pressed after entering name', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DuplicatePlanSheet {...defaultProps} visible={false} />,
    );
    // Transition to visible to trigger render-time state reset
    rerender(<DuplicatePlanSheet {...defaultProps} visible={true} />);
    await user.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        mealPlanId: 'mp-1',
        newName: 'Weekly Plan (Copy)',
        newStartDate: expect.any(String),
        newEndDate: expect.any(String),
      }),
    );
  });

  it('renders chevron navigation icons for date adjustment', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(screen.getByTestId('icon-chevron-back')).toBeTruthy();
    expect(screen.getByTestId('icon-chevron-forward')).toBeTruthy();
  });

  it('does not call onDuplicate when mealPlan is null', async () => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} mealPlan={null} />);
    await user.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onDuplicate).not.toHaveBeenCalled();
  });
});

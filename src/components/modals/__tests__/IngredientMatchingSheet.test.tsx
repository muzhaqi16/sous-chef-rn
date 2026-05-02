'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { IngredientMatchingSheet } from '../IngredientMatchingSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
        white: '#fff',
        textSecondary: '#666',
      },
    },
  })),
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      { testID: 'header' },
      R.createElement(RN.Text, null, title),
      R.createElement(
        RN.Pressable,
        { onPress: onCancel, testID: 'cancel-btn' },
        R.createElement(RN.Text, null, 'Cancel'),
      ),
      R.createElement(
        RN.Pressable,
        { onPress: onConfirm, testID: 'confirm-btn' },
        R.createElement(RN.Text, null, confirmLabel),
      ),
    );
  },
}));

jest.mock('#components/recipe/IngredientMatchRow', () => ({
  IngredientMatchRow: ({ editableMatch }: any) => {
    const { Text } = require('react-native');
    return require('react').createElement(
      Text,
      null,
      editableMatch.match.ingredient.name,
    );
  },
}));

describe('IngredientMatchingSheet', () => {
  const makeMatch = (name: string, id: string) => ({
    match: {
      ingredient: { id, name, isOptional: false },
      matchedPantryItem: null,
      suggestedUnit: null,
    },
    adjustedQuantity: 1,
    isIncluded: true,
  });

  const defaultProps: any = {
    visible: true,
    editableMatches: [makeMatch('Sugar', 'i1'), makeMatch('Flour', 'i2')],
    matchSummary: {
      available: 1,
      partial: 0,
      missing: 1,
      included: 2,
      total: 2,
    },
    onUpdate: jest.fn(),
    onConfirm: jest.fn(),
    onSkip: jest.fn(),
    onClose: jest.fn(),
    confirmLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    expect(screen.getByText('Review Ingredients')).toBeTruthy();
  });

  it('renders summary pills', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    expect(screen.getByText('1 Available')).toBeTruthy();
    expect(screen.getByText('1 Missing')).toBeTruthy();
  });

  it('renders included count', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    expect(screen.getByText('2/2 included')).toBeTruthy();
  });

  it('renders Skip Review button', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    expect(screen.getByText('Skip Review')).toBeTruthy();
  });

  it('renders confirm button with count', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    expect(screen.getByText('Confirm & Deduct (2)')).toBeTruthy();
  });

  it('calls onSkip when skip is pressed', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    fireEvent.press(screen.getByText('Skip Review'));
    expect(defaultProps.onSkip).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is pressed', () => {
    render(<IngredientMatchingSheet {...defaultProps} />);
    fireEvent.press(screen.getByText('Confirm & Deduct (2)'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });
});

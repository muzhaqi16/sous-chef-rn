'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { IngredientMatchingSheet } from '#features/recipes/components/modals/IngredientMatchingSheet';
import type {
  EditableMatch,
  MatchSummary,
} from '#features/recipes/hooks/useRecipeIngredientMatching';

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
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/molecules/BottomSheetHeader', () => ({
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
  }) => {
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

jest.mock('#features/recipes/components/IngredientMatchRow', () => ({
  IngredientMatchRow: ({
    editableMatch,
  }: {
    editableMatch: Pick<EditableMatch, 'ingredient'>;
  }) => {
    const { Text } = require('react-native');
    return require('react').createElement(
      Text,
      null,
      editableMatch.ingredient.name,
    );
  },
}));

describe('IngredientMatchingSheet', () => {
  const makeMatch = (name: string, id: string): EditableMatch => ({
    match: {
      __typename: 'RecipeIngredientMatch',
      isAvailable: true,
      matchConfidence: 1,
      availableQuantity: 1,
      suggestedQuantity: 1,
      shortfall: null,
      ingredient: { __typename: 'RecipeIngredient', id },
      matchedPantryItem: null,
      suggestedUnit: null,
    },
    ingredient: {
      __typename: 'RecipeIngredient',
      id,
      name,
      quantity: 1,
      estimatedPrice: null,
      image: null,
      isOptional: false,
      notes: null,
      preparation: null,
      sortOrder: 0,
      section: null,
      item: null,
      unit: null,
    },
    adjustedQuantity: 1,
    adjustedUnitId: null,
    isIncluded: true,
  });

  const matchSummary: MatchSummary = {
    available: 1,
    partial: 0,
    missing: 1,
    included: 2,
    total: 2,
  };

  const defaultProps = {
    visible: true,
    editableMatches: [makeMatch('Sugar', 'i1'), makeMatch('Flour', 'i2')],
    matchSummary,
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

  it('calls onSkip when skip is pressed', async () => {
    const user = userEvent.setup();
    render(<IngredientMatchingSheet {...defaultProps} />);
    await user.press(screen.getByText('Skip Review'));
    expect(defaultProps.onSkip).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is pressed', async () => {
    const user = userEvent.setup();
    render(<IngredientMatchingSheet {...defaultProps} />);
    await user.press(screen.getByText('Confirm & Deduct (2)'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });
});

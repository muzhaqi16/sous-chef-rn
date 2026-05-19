'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo as render } from '#/test-utils/apolloMockProvider';
import { MealPlanSettingsSheet } from '../MealPlanSettingsSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: any) => children,
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="bottom-sheet-header">
        <Text>{title}</Text>
        <Pressable onPress={onCancel} testID="cancel-button">
          <Text>Cancel</Text>
        </Pressable>
        <Pressable onPress={onConfirm} testID="confirm-button">
          <Text>{confirmLabel}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../NutritionSummaryCard', () => ({
  NutritionSummaryCard: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="nutrition-summary-card">
        <Text>Nutrition Summary</Text>
      </View>
    );
  },
}));

const makeMealPlan = (overrides?: any) => ({
  __typename: 'MealPlan',
  id: 'mp-1',
  name: 'Weekly Plan',
  description: 'My meal plan description',
  startDate: '2024-03-01',
  endDate: '2024-03-07',
  home: { name: 'My Home' },
  createdBy: { profile: { displayName: 'John Doe' } },
  nutritionSummary: null,
  nutritionGoalProgress: null,
  generatedShoppingLists: [],
  ...overrides,
});

const defaultPermissions = {
  canDelete: true,
  canEdit: true,
  canShare: true,
  canDuplicate: true,
  isOwner: true,
};

const defaultProps: any = {
  visible: true,
  mealPlan: makeMealPlan(),
  permissions: defaultPermissions,
  onClose: jest.fn(),
  onDuplicate: jest.fn(),
  onGenerateShoppingList: jest.fn(),
  onDelete: jest.fn(),
  deleting: false,
};

describe('MealPlanSettingsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Plan Settings header', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Plan Settings')).toBeTruthy();
  });

  it('renders null when mealPlan is null', () => {
    render(<MealPlanSettingsSheet {...defaultProps} mealPlan={null} />);
    expect(screen.queryByText('Plan Settings')).toBeNull();
  });

  it('renders the plan name', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Weekly Plan')).toBeTruthy();
  });

  it('renders the plan description', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('My meal plan description')).toBeTruthy();
  });

  it('renders the date range', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Mar 1 - Mar 7, 2024')).toBeTruthy();
  });

  it('renders the home name', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Shared with My Home')).toBeTruthy();
  });

  it('renders the creator name', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Created by John Doe')).toBeTruthy();
  });

  it('renders action items', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Generate Shopping List')).toBeTruthy();
    expect(screen.getByText('Duplicate Plan')).toBeTruthy();
    expect(screen.getByText('View Nutrition')).toBeTruthy();
  });

  it('renders Delete Plan when user has delete permission', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Delete Plan')).toBeTruthy();
  });

  it('does not render Delete Plan when user lacks delete permission', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        permissions={{ ...defaultPermissions, canDelete: false } as any}
      />,
    );
    expect(screen.queryByText('Delete Plan')).toBeNull();
  });

  it('shows Deleting... text when deleting', () => {
    render(<MealPlanSettingsSheet {...defaultProps} deleting={true} />);
    expect(screen.getByText('Deleting...')).toBeTruthy();
  });

  it('does not show description when not provided', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlan={makeMealPlan({ description: null })}
      />,
    );
    expect(screen.queryByText('My meal plan description')).toBeNull();
  });

  it('renders generated shopping lists when they exist', () => {
    const mealPlan = makeMealPlan({
      generatedShoppingLists: [
        { id: 'sl-1', name: 'Grocery Run 1' },
        { id: 'sl-2', name: 'Grocery Run 2' },
      ],
    });
    render(<MealPlanSettingsSheet {...defaultProps} mealPlan={mealPlan} />);
    expect(screen.getByText('Generated Lists')).toBeTruthy();
    expect(screen.getByText('Grocery Run 1')).toBeTruthy();
    expect(screen.getByText('Grocery Run 2')).toBeTruthy();
  });
});

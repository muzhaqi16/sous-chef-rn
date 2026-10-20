'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  seedCache,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { MealPlanSettingsSheet } from '../MealPlanSettingsSheet';
import {
  MealPlanSettingsSheet_MealPlanFragmentDoc,
  type MealPlanSettingsSheet_MealPlanFragment,
} from '../MealPlanSettingsSheet.generated';
import type { MealPlanPermissions } from '#features/mealPlan/utils/mealPlanPermissions';

type MealPlanSettingsSheetProps = React.ComponentProps<
  typeof MealPlanSettingsSheet
>;

/**
 * Production hands the sheet a masked `{ __typename, id }` ref and keeps the
 * fields in the cache. A fixture passing the full object with an empty cache
 * passes only because of a fallback that crashes in production.
 */
function render(element: React.ReactElement<MealPlanSettingsSheetProps>) {
  const plan = element.props
    .mealPlanRef as MealPlanSettingsSheet_MealPlanFragment | null;
  if (!plan) return renderWithApollo(element);
  const cache = seedCache([
    {
      fragment: MealPlanSettingsSheet_MealPlanFragmentDoc,
      fragmentName: 'MealPlanSettingsSheet_mealPlan',
      data: plan,
    },
  ]);
  return renderWithApollo(
    React.cloneElement(element, {
      mealPlanRef: toFragmentRef<
        typeof MealPlanSettingsSheet_MealPlanFragmentDoc
      >({ __typename: 'MealPlan', id: plan.id }),
    }),
    { cache },
  );
}

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
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
    confirmLabel: string;
  }) => {
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

type GeneratedLists =
  MealPlanSettingsSheet_MealPlanFragment['generatedShoppingListsConnection'];

/** The lists a plan generated, as the edges of its connection. */
const generatedLists = (
  lists: Array<{ id: string; name: string }>,
): GeneratedLists => ({
  __typename: 'ShoppingListConnection',
  edges: lists.map(list => ({
    __typename: 'ShoppingListEdge',
    node: { __typename: 'ShoppingList', ...list },
  })),
  pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
  totalCount: lists.length,
});

const makeMealPlan = (
  overrides?: Partial<MealPlanSettingsSheet_MealPlanFragment>,
): MealPlanSettingsSheet_MealPlanFragment => ({
  __typename: 'MealPlan',
  id: 'mp-1',
  name: 'Weekly Plan',
  description: 'My meal plan description',
  startDate: '2024-03-01',
  endDate: '2024-03-07',
  budgetAmount: null,
  actualCost: null,
  dietaryProfile: null,
  home: { __typename: 'Home', id: 'home-1', name: 'My Home' },
  createdBy: {
    __typename: 'User',
    id: 'user-1',
    profile: {
      __typename: 'UserProfile',
      id: 'profile-1',
      displayName: 'John Doe',
    },
  },
  nutritionSummary: {
    __typename: 'MealPlanNutritionSummary',
    totalCalories: 0,
    avgDailyCalories: 0,
    avgDailyProtein: 0,
    avgDailyCarbs: 0,
    avgDailyFat: 0,
    totalMeals: 0,
    mealsWithNutrition: 0,
    coveragePercentage: 0,
  },
  nutritionGoalProgress: null,
  generatedShoppingListsConnection: generatedLists([]),
  ...overrides,
});

const defaultPermissions: MealPlanPermissions = {
  canDelete: true,
  canEdit: true,
  canDuplicate: true,
  canGenerateShoppingList: true,
  canSaveAsTemplate: true,
};

const defaultProps: MealPlanSettingsSheetProps = {
  visible: true,
  mealPlanRef: makeMealPlan(),
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
    render(<MealPlanSettingsSheet {...defaultProps} mealPlanRef={null} />);
    expect(screen.queryByText('Plan Settings')).toBeNull();
  });

  // Deleting the selected plan evicts it while this sheet is still mounted and
  // the query still hands it the masked ref. Reading its generated lists off
  // that ref threw and took the Meal Plan screen down with it.
  it('renders nothing for a plan evicted from the cache, rather than crashing', () => {
    expect(() =>
      renderWithApollo(
        <MealPlanSettingsSheet
          {...defaultProps}
          mealPlanRef={toFragmentRef<
            typeof MealPlanSettingsSheet_MealPlanFragmentDoc
          >({ __typename: 'MealPlan', id: 'mp-deleted' })}
        />,
      ),
    ).not.toThrow();
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

  it('shows spend vs budget when a budget is set', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ budgetAmount: 50, actualCost: 30 })}
      />,
    );
    expect(screen.getByText('Spent $30.00 of $50.00')).toBeTruthy();
    expect(screen.queryByText('Budget $50.00')).toBeNull();
  });

  // No recorded spend is unknown, not a spend of zero.
  it('shows the budget alone when no spend is recorded against it', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ budgetAmount: 50, actualCost: null })}
      />,
    );
    expect(screen.getByText('Budget $50.00')).toBeTruthy();
    expect(screen.queryByText(/Spent/)).toBeNull();
  });

  it('shows a recorded spend of zero against the budget as zero', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ budgetAmount: 50, actualCost: 0 })}
      />,
    );
    expect(screen.getByText('Spent $0.00 of $50.00')).toBeTruthy();
  });

  it('shows the spend alone when there is no budget', () => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ budgetAmount: null, actualCost: 30 })}
      />,
    );
    expect(screen.getByText('Spent $30.00')).toBeTruthy();
    expect(screen.queryByText(/Budget/)).toBeNull();
  });

  it.each([
    ['no spend is recorded', null],
    ['the recorded spend is zero', 0],
  ])('shows no cost line without a budget when %s', (_label, actualCost) => {
    render(
      <MealPlanSettingsSheet
        {...defaultProps}
        mealPlanRef={makeMealPlan({ budgetAmount: null, actualCost })}
      />,
    );
    expect(screen.getByText('Weekly Plan')).toBeTruthy();
    expect(screen.queryByText(/Spent/)).toBeNull();
    expect(screen.queryByText(/Budget/)).toBeNull();
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
        permissions={{ ...defaultPermissions, canDelete: false }}
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
        mealPlanRef={makeMealPlan({ description: null })}
      />,
    );
    expect(screen.queryByText('My meal plan description')).toBeNull();
  });

  it('renders the lists the plan generated, from the edges of its connection', () => {
    const mealPlan = makeMealPlan({
      generatedShoppingListsConnection: generatedLists([
        { id: 'sl-1', name: 'Grocery Run 1' },
        { id: 'sl-2', name: 'Grocery Run 2' },
      ]),
    });
    render(<MealPlanSettingsSheet {...defaultProps} mealPlanRef={mealPlan} />);
    expect(screen.getByText('Generated Lists')).toBeTruthy();
    expect(screen.getByText('Grocery Run 1')).toBeTruthy();
    expect(screen.getByText('Grocery Run 2')).toBeTruthy();
  });

  it('renders no generated-lists section for a plan that generated none', () => {
    render(<MealPlanSettingsSheet {...defaultProps} />);
    expect(screen.getByText('Weekly Plan')).toBeTruthy();
    expect(screen.queryByText('Generated Lists')).toBeNull();
  });
});

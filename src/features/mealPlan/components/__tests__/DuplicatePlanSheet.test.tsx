'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#i18n';
import type { MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { MealPlanType, MembershipRole } from '#graphql/generated/schemaTypes';
import { DuplicatePlanSheet } from '../DuplicatePlanSheet';

jest.mock('#components/atoms/Icon', () => ({
  Icon: (props: { name: string }) => {
    const RN = require('react-native');
    return require('react').createElement(
      RN.Text,
      { testID: `icon-${props.name}` },
      props.name,
    );
  },
}));

describe('DuplicatePlanSheet', () => {
  const mockMealPlan: MealPlanDisplayFragment = {
    __typename: 'MealPlan',
    id: 'mp-1',
    name: 'Weekly Plan',
    description: null,
    planType: MealPlanType.Weekly,
    startDate: '2025-03-01',
    endDate: '2025-03-07',
    servings: 4,
    totalCalories: null,
    totalProtein: null,
    totalCarbs: null,
    totalFat: null,
    actualCost: 0,
    budgetAmount: null,
    homeId: null,
    version: 1,
    createdAt: '2025-03-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
    home: {
      __typename: 'Home',
      version: 1,
      id: 'home-1',
      name: 'Test Home',
      myMembership: {
        __typename: 'Membership',
        version: 1,
        id: 'm-1',
        role: MembershipRole.Owner,
      },
    },
    user: {
      __typename: 'User',
      id: 'user-1',
    },
    createdBy: {
      __typename: 'User',
      id: 'user-1',
      profile: null,
    },
  };

  const defaultProps = {
    visible: true,
    mealPlan: mockMealPlan,
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
    // A required field's label ends in its marker.
    expect(screen.getByText('New Plan Name', { exact: false })).toBeTruthy();
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

  const duplicateButton = () =>
    screen.getByRole('button', { name: t('duplicatePlan.duplicate') });
  const nameInput = () => screen.getByDisplayValue('Weekly Plan (Copy)');

  it('holds the duplicate while one is in flight', () => {
    render(<DuplicatePlanSheet {...defaultProps} loading={true} />);
    expect(duplicateButton()).toBeDisabled();
  });

  it('offers Duplicate when not loading', () => {
    render(<DuplicatePlanSheet {...defaultProps} loading={false} />);
    expect(duplicateButton()).toBeEnabled();
  });

  it('calls onClose when close is pressed', async () => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} />);
    await user.press(screen.getByRole('button', { name: t('labels.close') }));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onDuplicate).not.toHaveBeenCalled();
  });

  it('calls onDuplicate with correct data when confirm is pressed after entering name', async () => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} />);
    await user.press(duplicateButton());
    expect(defaultProps.onDuplicate).toHaveBeenCalledWith({
      mealPlanId: 'mp-1',
      newName: 'Weekly Plan (Copy)',
      newStartDate: '2025-03-08',
      newEndDate: '2025-03-14',
    });
  });

  it('sends the name as typed, trimmed', async () => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} />);
    fireEvent.changeText(nameInput(), '  Spring Plan  ');
    await user.press(duplicateButton());
    const [[sent]] = defaultProps.onDuplicate.mock.calls;
    expect(sent.newName).toBe('Spring Plan');
  });

  it('asks for a name on the field when duplicated without one', async () => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} />);
    fireEvent.changeText(nameInput(), '   ');
    await user.press(duplicateButton());
    expect(
      screen.getByText(t('mealPlan.nameRequiredMessage')),
    ).toBeOnTheScreen();
    expect(defaultProps.onDuplicate).not.toHaveBeenCalled();
    expect(duplicateButton()).toBeEnabled();
  });

  it('opens fresh: the name, week and error go with the closing', async () => {
    const user = userEvent.setup();
    const view = render(<DuplicatePlanSheet {...defaultProps} />);
    fireEvent.changeText(nameInput(), '');
    await user.press(screen.getByTestId('icon-chevron-forward'));
    await user.press(duplicateButton());
    expect(
      screen.getByText(t('mealPlan.nameRequiredMessage')),
    ).toBeOnTheScreen();

    view.rerender(<DuplicatePlanSheet {...defaultProps} visible={false} />);
    view.rerender(<DuplicatePlanSheet {...defaultProps} visible={true} />);

    expect(nameInput()).toBeOnTheScreen();
    expect(screen.queryByText(t('mealPlan.nameRequiredMessage'))).toBeNull();
    await user.press(duplicateButton());
    const [[sent]] = defaultProps.onDuplicate.mock.calls;
    expect(sent.newStartDate).toBe('2025-03-08');
  });

  const confirmWith = (mealPlan: MealPlanDisplayFragment) => {
    const user = userEvent.setup();
    render(<DuplicatePlanSheet {...defaultProps} mealPlan={mealPlan} />);
    return user;
  };

  // The copy starts the day after the source ends and covers as many days.
  // 9 March 2025 is a 23-hour day in the US: the last day is still the 14th.
  it('sends the copy first and last day as day keys, the same number of days long', async () => {
    const user = confirmWith(mockMealPlan);
    await user.press(duplicateButton());

    const [[sent]] = defaultProps.onDuplicate.mock.calls;
    expect(sent.newStartDate).toBe('2025-03-08');
    expect(sent.newEndDate).toBe('2025-03-14');
  });

  it('steps the copy a week at a time, across a month boundary', async () => {
    const user = confirmWith({
      ...mockMealPlan,
      startDate: '2025-03-22',
      endDate: '2025-03-28',
    });
    await user.press(screen.getByTestId('icon-chevron-forward'));
    await user.press(duplicateButton());

    const [[sent]] = defaultProps.onDuplicate.mock.calls;
    expect(sent.newStartDate).toBe('2025-04-05');
    expect(sent.newEndDate).toBe('2025-04-11');
  });

  it('copies a one-day plan onto one day', async () => {
    const user = confirmWith({
      ...mockMealPlan,
      startDate: '2025-03-07',
      endDate: '2025-03-07',
    });
    await user.press(duplicateButton());

    const [[sent]] = defaultProps.onDuplicate.mock.calls;
    expect(sent.newStartDate).toBe('2025-03-08');
    expect(sent.newEndDate).toBe('2025-03-08');
  });

  it('renders chevron navigation icons for date adjustment', () => {
    render(<DuplicatePlanSheet {...defaultProps} />);
    expect(screen.getByTestId('icon-chevron-back')).toBeTruthy();
    expect(screen.getByTestId('icon-chevron-forward')).toBeTruthy();
  });

  it('offers nothing to duplicate when mealPlan is null', () => {
    render(<DuplicatePlanSheet {...defaultProps} mealPlan={null} />);
    expect(
      screen.queryByRole('button', { name: t('duplicatePlan.duplicate') }),
    ).toBeNull();
    expect(defaultProps.onDuplicate).not.toHaveBeenCalled();
  });
});

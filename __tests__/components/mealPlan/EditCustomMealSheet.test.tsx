'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { MealType } from '../../../src/graphql/generated/schemaTypes';
import { EditCustomMealSheet } from '../../../src/features/mealPlan/components/EditCustomMealSheet';
import type { EditCustomMealSheet_ItemFragment } from '../../../src/features/mealPlan/components/EditCustomMealSheet.generated';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: { colors: {} },
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('../../../src/components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
  },
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

describe('EditCustomMealSheet', () => {
  const defaultProps = {
    visible: true,
    item: {
      __typename: 'MealPlanItem',
      id: 'mp1',
      mealType: MealType.Dinner,
      customMealName: 'Pasta Night',
      notes: 'With garlic bread',
    } satisfies EditCustomMealSheet_ItemFragment,
    onClose: jest.fn(),
    onSave: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<EditCustomMealSheet {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Edit Custom Meal title', () => {
    const { getByText } = render(<EditCustomMealSheet {...defaultProps} />);
    expect(getByText('Edit Custom Meal')).toBeTruthy();
  });

  it('renders Meal Name input', () => {
    const { getByText } = render(<EditCustomMealSheet {...defaultProps} />);
    expect(getByText('Meal Name')).toBeTruthy();
  });

  it('renders Notes input', () => {
    const { getByText } = render(<EditCustomMealSheet {...defaultProps} />);
    expect(getByText('Notes (Optional)')).toBeTruthy();
  });
});

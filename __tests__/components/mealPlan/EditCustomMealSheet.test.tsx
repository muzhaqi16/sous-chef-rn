'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { EditCustomMealSheet } from '../../../src/components/mealPlan/EditCustomMealSheet';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: { colors: {} },
  }),
}));
jest.mock('../../../src/components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: any) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
  },
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

describe('EditCustomMealSheet', () => {
  const defaultProps = {
    visible: true,
    item: {
      id: 'mp1',
      mealType: 'DINNER',
      customMealName: 'Pasta Night',
      notes: 'With garlic bread',
      isCompleted: false,
      recipe: null,
      servings: null,
      calories: null,
      usedPantryItems: [],
    } as any,
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

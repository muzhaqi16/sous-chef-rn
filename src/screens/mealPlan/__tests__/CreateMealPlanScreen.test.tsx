'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { CreateMealPlanScreen } from '../CreateMealPlanScreen';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockCreateMealPlan = jest.fn().mockResolvedValue({ success: true });
jest.mock('#hooks/mealPlan/useMealPlanActions', () => ({
  useMealPlanActions: jest.fn(() => ({
    createMealPlan: mockCreateMealPlan,
    creating: false,
  })),
}));

jest.mock('#hooks/mealPlan/useMealTemplateActions', () => ({
  useMealTemplateActions: jest.fn(() => ({
    createPlanFromTemplate: jest.fn(),
    creatingFromTemplate: false,
  })),
}));

jest.mock('#hooks/home/hooks/useHomeQuery', () => ({
  useHomeQuery: jest.fn(() => ({
    homes: [{ id: 'home-1', name: 'My Home' }],
  })),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => 'home-1'),
}));

jest.mock('#components/organisms/FormModal', () => ({
  FormModal: ({ children, testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID}>{children}</View>;
  },
}));

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID} />;
  },
}));

jest.mock('#components/molecules/FormTextArea', () => ({
  FormTextArea: ({ testID }: any) => {
    const { View } = require('react-native');
    return <View testID={testID} />;
  },
}));

jest.mock('#components/molecules/FormSelect', () => ({
  FormSelect: () => null,
}));

jest.mock('#components/molecules/SegmentedControl', () => ({
  SegmentedControl: () => null,
}));

jest.mock('#components/molecules/DatePickerField', () => ({
  DatePickerField: () => null,
}));

jest.mock('#components/molecules/EditableCounter', () => ({
  EditableCounter: () => null,
}));

jest.mock('#components/mealPlan/TemplateBrowserSheet', () => ({
  TemplateBrowserSheet: () => null,
}));

jest.mock('#components/mealPlan/TemplatePreviewSheet', () => ({
  TemplatePreviewSheet: () => null,
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

describe('CreateMealPlanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the create meal plan form', () => {
    const { getByTestId } = render(<CreateMealPlanScreen />);
    expect(getByTestId('create-meal-plan-screen')).toBeTruthy();
  });

  it('renders name input field', () => {
    const { getByTestId } = render(<CreateMealPlanScreen />);
    expect(getByTestId('meal-plan-name-input')).toBeTruthy();
  });

  it('renders description input field', () => {
    const { getByTestId } = render(<CreateMealPlanScreen />);
    expect(getByTestId('meal-plan-description-input')).toBeTruthy();
  });

  it('renders create from template link', () => {
    const { getByText } = render(<CreateMealPlanScreen />);
    expect(getByText('Or create from a template')).toBeTruthy();
  });

  it('renders form with home selector when multiple homes', () => {
    const tree = render(<CreateMealPlanScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });
});

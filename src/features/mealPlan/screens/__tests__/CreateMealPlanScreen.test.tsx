'use no memo';

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { addDays } from 'date-fns';
import { toMealDateTime } from '#/utils/dateUtils';
import { CreateMealPlanScreen } from '../CreateMealPlanScreen';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockCreateMealPlan = jest.fn().mockResolvedValue({ success: true });
jest.mock('#features/mealPlan/hooks/useMealPlanActions', () => ({
  useMealPlanActions: jest.fn(() => ({
    createMealPlan: mockCreateMealPlan,
    creating: false,
  })),
}));

jest.mock('#features/mealPlan/hooks/useMealTemplateActions', () => ({
  useMealTemplateActions: jest.fn(() => ({
    createPlanFromTemplate: jest.fn(),
    creatingFromTemplate: false,
  })),
}));

jest.mock('#features/home/hooks/useHomeQuery', () => ({
  useHomeQuery: jest.fn(() => ({
    homes: [{ id: 'home-1', name: 'My Home' }],
  })),
}));

jest.mock('#features/profile/hooks/useDietaryProfile', () => ({
  useDietaryProfile: jest.fn(() => ({ profile: null })),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => 'home-1'),
  useSelectedHomeId: jest.fn(() => 'home-1'),
}));

jest.mock('#components/templates/FormScreen', () => ({
  FormScreen: ({
    children,
    testID,
    onSave,
  }: {
    children?: React.ReactNode;
    testID?: string;
    onSave?: () => void;
  }) => {
    const { Pressable, View } = require('react-native');
    return (
      <View testID={testID}>
        {children}
        <Pressable testID="form-save" onPress={onSave} />
      </View>
    );
  },
}));

jest.mock('#components/atoms/FormInput', () => ({
  FormInput: ({
    testID,
    value,
    onChangeText,
  }: {
    testID?: string;
    value?: string;
    onChangeText?: (text: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput testID={testID} value={value} onChangeText={onChangeText} />
    );
  },
}));

jest.mock('#components/atoms/FormTextArea', () => ({
  FormTextArea: ({ testID }: { testID?: string }) => {
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

// A picked day arrives as local midnight; the pick itself is the test's input.
const mockPickedDay = new Date(2026, 9, 5);
jest.mock('#components/molecules/DatePickerField', () => ({
  DatePickerField: ({ onChange }: { onChange: (date: Date) => void }) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable
        testID="start-date-pick"
        onPress={() => onChange(mockPickedDay)}
      />
    );
  },
}));

jest.mock('#components/molecules/EditableCounter', () => ({
  EditableCounter: () => null,
}));

jest.mock('#features/mealPlan/components/TemplateBrowserSheet', () => ({
  TemplateBrowserSheet: () => null,
}));

jest.mock('#features/mealPlan/components/TemplatePreviewSheet', () => ({
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

  it('renders the budget input field', () => {
    const { getByTestId } = render(<CreateMealPlanScreen />);
    expect(getByTestId('meal-plan-budget-input')).toBeTruthy();
  });

  it('shows the nutrition-tracking toggle only when the user has a dietary profile', () => {
    // Default mock returns no profile → no toggle.
    expect(
      render(<CreateMealPlanScreen />).queryByText('Track nutrition goals'),
    ).toBeNull();

    (useDietaryProfile as jest.Mock).mockReturnValue({
      profile: { id: 'dp-1' },
    });
    const { getByText } = render(<CreateMealPlanScreen />);
    expect(getByText('Track nutrition goals')).toBeTruthy();
  });
  // The API compares a meal to its plan by UTC day, so the boundaries are sent
  // as local noon of the picked days; local midnight lands on the previous UTC
  // day east of UTC.
  it('sends the plan boundaries as local noon of the picked days', async () => {
    const { getByTestId } = render(<CreateMealPlanScreen />);
    fireEvent.changeText(getByTestId('meal-plan-name-input'), 'Week one');
    fireEvent.press(getByTestId('start-date-pick'));
    fireEvent.press(getByTestId('form-save'));

    await waitFor(() => expect(mockCreateMealPlan).toHaveBeenCalled());
    expect(mockCreateMealPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: toMealDateTime(mockPickedDay),
        endDate: toMealDateTime(addDays(mockPickedDay, 6)),
      }),
      expect.anything(),
    );
  });
});

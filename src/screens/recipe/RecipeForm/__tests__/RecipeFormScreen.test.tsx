'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RecipeFormScreen } from '../index';

jest.mock('../../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockGoBack = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: mockGoBack }),
}));

const mockCreateRecipe = jest.fn().mockResolvedValue({ data: { createRecipe: { success: true } } });
const mockUpdateRecipe = jest.fn().mockResolvedValue({ data: { updateRecipe: { success: true } } });

jest.mock('#generated', () => ({
  useGetRecipeQuery: jest.fn(() => ({ data: null })),
  useCreateRecipeMutation: () => [mockCreateRecipe, { loading: false }],
  useUpdateRecipeMutation: () => [mockUpdateRecipe, { loading: false }],
  Difficulty: { Easy: 'EASY' },
  RecipeCategory: { MainCourse: 'MAIN_COURSE' },
  Visibility: { Public: 'PUBLIC' },
  Diet: { Vegan: 'VEGAN' },
  HealthGoal: { WeightLoss: 'WEIGHT_LOSS' },
  Intolerance: { GlutenFree: 'GLUTEN_FREE' },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutationWithErrorHandler: jest.fn(async (fn: () => Promise<any>, onError?: (e: any) => void) => {
    try {
      return await fn();
    } catch (e) {
      if (onError) onError(e);
      return null;
    }
  }),
}));

jest.mock('../components/RecipeBasicFields', () => ({
  RecipeBasicFields: () => null,
}));
jest.mock('../components/RecipeCategoryFields', () => ({
  RecipeCategoryFields: () => null,
}));
jest.mock('../components/RecipeIngredientList', () => ({
  RecipeIngredientList: () => null,
}));
jest.mock('../components/RecipeIngredientEditor', () => ({
  RecipeIngredientEditor: require('react').forwardRef(() => null),
}));
jest.mock('../components/RecipeStepList', () => ({
  RecipeStepList: () => null,
}));
jest.mock('../components/RecipeStepEditor', () => ({
  RecipeStepEditor: require('react').forwardRef(() => null),
}));
jest.mock('../components/RecipeTagsSection', () => ({
  RecipeTagsSection: () => null,
}));
jest.mock('#components/organisms/FormModal', () => ({
  FormModal: ({ children, onSave, title, testID }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        <Pressable testID="save-button" onPress={onSave}><Text>Save</Text></Pressable>
        {children}
      </View>
    );
  },
}));

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecipeFormScreen', () => {
  const defaultProps = {
    route: { params: undefined },
  } as any;

  it('renders in create mode', () => {
    const { getByText } = render(<RecipeFormScreen {...defaultProps} />);
    expect(getByText('Create Recipe')).toBeTruthy();
  });

  it('renders in edit mode with recipeId', () => {
    const props = { route: { params: { recipeId: 'recipe-1' } } } as any;
    const { getByText } = render(<RecipeFormScreen {...props} />);
    expect(getByText('Edit Recipe')).toBeTruthy();
  });

  it('shows validation error on save with empty form', () => {
    const { getByTestId } = render(<RecipeFormScreen {...defaultProps} />);

    fireEvent.press(getByTestId('save-button'));

    expect(Alert.alert).toHaveBeenCalledWith('Validation Error', expect.any(String));
  });

  it('renders with test ID', () => {
    const { getByTestId } = render(<RecipeFormScreen {...defaultProps} />);
    expect(getByTestId('recipe-form-screen')).toBeTruthy();
  });

  it('does not call create mutation when validation fails', () => {
    const { getByTestId } = render(<RecipeFormScreen {...defaultProps} />);

    fireEvent.press(getByTestId('save-button'));

    expect(mockCreateRecipe).not.toHaveBeenCalled();
  });
});

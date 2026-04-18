'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { RecipeFormScreen } from '../index';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockCreateRecipe = jest
  .fn()
  .mockResolvedValue({ data: { createRecipe: { success: true } } });
const mockUpdateRecipe = jest
  .fn()
  .mockResolvedValue({ data: { updateRecipe: { success: true } } });

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetRecipeQuery: jest.fn(() => ({ data: null })),
  useCreateRecipeMutation: () => [mockCreateRecipe, { loading: false }],
  useUpdateRecipeMutation: () => [mockUpdateRecipe, { loading: false }],
  useUpdateRecipeIngredientsMutation: () => [jest.fn(), { loading: false }],
}));

jest.mock('#/utils/compilerSafeWrappers');

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
        <Pressable testID="save-button" onPress={onSave}>
          <Text>Save</Text>
        </Pressable>
        {children}
      </View>
    );
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

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

    expect(alertService.alert).toHaveBeenCalledWith(
      'Validation Error',
      expect.any(String),
    );
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

'use no memo';

import React from 'react';
import { userEvent } from '@testing-library/react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { CreateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { storeApi } from '#store';
import { RecipeFormScreen } from '../index';

type RecipeFormScreenProps = StaticScreenProps<
  { recipeId?: string } | undefined
>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#/utils/finallyHelpers');

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
  FormModal: ({
    children,
    onSave,
    title,
    testID,
  }: {
    children?: React.ReactNode;
    onSave: () => void;
    title: string;
    testID?: string;
  }) => {
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

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // The screen is online-only; `apiReachable: false` is what its guard keys on.
  storeApi.getState().setApiReachable(true);
});

afterEach(() => {
  storeApi.getState().setApiReachable(true);
});

describe('RecipeFormScreen', () => {
  const defaultProps: RecipeFormScreenProps = {
    route: { params: undefined },
  };

  it('renders in create mode', () => {
    const { getByText } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );
    expect(getByText('Create Recipe')).toBeTruthy();
  });

  it('renders in edit mode with recipeId', () => {
    const props: RecipeFormScreenProps = {
      route: { params: { recipeId: 'recipe-1' } },
    };
    const { getByText } = renderWithApollo(<RecipeFormScreen {...props} />);
    expect(getByText('Edit Recipe')).toBeTruthy();
  });

  it('shows validation error on save with empty form', async () => {
    const user = userEvent.setup();
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );

    await user.press(getByTestId('save-button'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Validation Error',
      expect.any(String),
    );
  });

  it('renders with test ID', () => {
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );
    expect(getByTestId('recipe-form-screen')).toBeTruthy();
  });

  it('does not call create mutation when validation fails', async () => {
    const user = userEvent.setup();
    const create = recordMock(CreateRecipeDocument, {
      data: {
        createRecipe: {
          __typename: 'CreateRecipePayload',
          success: true,
        },
      },
    });
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
      { operationMocks: [create.mock] },
    );

    await user.press(getByTestId('save-button'));

    expect(create.fired).toEqual([]);
  });

  it('refuses to save while the API is unavailable', async () => {
    const user = userEvent.setup();
    const create = recordMock(CreateRecipeDocument, {
      data: {
        createRecipe: {
          __typename: 'CreateRecipePayload',
          success: true,
        },
      },
    });
    const { getByTestId } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
      { operationMocks: [create.mock] },
    );
    storeApi.getState().setApiReachable(false);

    await user.press(getByTestId('save-button'));

    expect(toastService.error).toHaveBeenCalledWith('Not available offline');
    expect(create.fired).toEqual([]);
    // The offline guard precedes validation, so no field error is raised either.
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});

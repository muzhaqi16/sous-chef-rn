'use no memo';

import React from 'react';
import { userEvent } from '@testing-library/react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { CreateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { alertService } from '#/services/alertService';
import { RecipeFormScreen } from '../index';

type RecipeFormScreenProps = StaticScreenProps<
  { recipeId?: string } | undefined
>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#/utils/finallyHelpers');

// The three field components render their refusal so the screen test can see
// WHERE each message landed, which an alert-based check could not tell apart.
jest.mock('#features/recipes/components/recipeForm/RecipeBasicFields', () => ({
  RecipeBasicFields: ({
    errors,
  }: {
    errors?: { name?: { message?: string } };
  }) => {
    const { Text } = require('react-native');
    return errors?.name?.message ? <Text>{errors.name.message}</Text> : null;
  },
}));
jest.mock(
  '#features/recipes/components/recipeForm/RecipeCategoryFields',
  () => ({
    RecipeCategoryFields: () => null,
  }),
);
jest.mock(
  '#features/recipes/components/recipeForm/RecipeIngredientList',
  () => ({
    RecipeIngredientList: ({ error }: { error?: string }) => {
      const { Text } = require('react-native');
      return error ? <Text>{error}</Text> : null;
    },
  }),
);
jest.mock(
  '#features/recipes/components/recipeForm/RecipeIngredientEditor',
  () => ({
    RecipeIngredientEditor: require('react').forwardRef(() => null),
  }),
);
jest.mock('#features/recipes/components/recipeForm/RecipeStepList', () => ({
  RecipeStepList: ({ error }: { error?: string }) => {
    const { Text } = require('react-native');
    return error ? <Text>{error}</Text> : null;
  },
}));
jest.mock('#features/recipes/components/recipeForm/RecipeStepEditor', () => ({
  RecipeStepEditor: require('react').forwardRef(() => null),
}));
jest.mock('#features/recipes/components/recipeForm/RecipeTagsSection', () => ({
  RecipeTagsSection: () => null,
}));
jest.mock('#components/templates/FormScreen', () => ({
  FormScreen: ({
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

beforeEach(() => {
  jest.clearAllMocks();
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

  // A field the user can fix is reported ON the field. An alert covers the form,
  // and a dismissed alert cannot say which input it meant.
  it('reports an empty form on its fields, not through an alert', async () => {
    const user = userEvent.setup();
    const { getByTestId, findByText } = renderWithApollo(
      <RecipeFormScreen {...defaultProps} />,
    );

    await user.press(getByTestId('save-button'));

    expect(await findByText('Recipe name is required')).toBeTruthy();
    expect(
      await findByText('At least one ingredient is required'),
    ).toBeTruthy();
    expect(
      await findByText('At least one instruction step is required'),
    ).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
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
});

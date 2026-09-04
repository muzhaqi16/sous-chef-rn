'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { MealTemplateBuilderScreen } from '../MealTemplateBuilderScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/mealPlan/hooks/useMealTemplateEditor', () => ({
  useMealTemplateEditor: jest.fn(() => ({
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    creating: false,
    updating: false,
    addingItem: false,
  })),
}));

jest.mock('#components/templates/FormScreen', () => ({
  FormScreen: ({
    children,
    title,
    testID,
  }: {
    children?: React.ReactNode;
    title?: string;
    testID?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('#components/atoms/FormInput', () => ({
  FormInput: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID} />;
  },
}));
jest.mock('#components/atoms/FormTextArea', () => ({
  FormTextArea: () => null,
}));
jest.mock('#components/molecules/FormSelect', () => ({
  FormSelect: () => null,
}));
jest.mock('#components/molecules/EditableCounter', () => ({
  EditableCounter: () => null,
}));

describe('MealTemplateBuilderScreen', () => {
  it('renders the create form with a "New Template" title', () => {
    renderWithApollo(
      <MealTemplateBuilderScreen route={{ params: undefined }} />,
    );
    expect(screen.getByTestId('meal-template-builder-screen')).toBeTruthy();
    expect(screen.getByTestId('template-name-input')).toBeTruthy();
    expect(screen.getByText('New Template')).toBeTruthy();
  });

  it('shows the empty-meals hint before any meal is added', () => {
    renderWithApollo(
      <MealTemplateBuilderScreen route={{ params: undefined }} />,
    );
    expect(screen.getByText('No meals added yet')).toBeTruthy();
  });

  it('renders the edit title when a templateId is provided', () => {
    renderWithApollo(
      <MealTemplateBuilderScreen route={{ params: { templateId: 'tpl-1' } }} />,
    );
    expect(screen.getByText('Edit Template')).toBeTruthy();
  });
});

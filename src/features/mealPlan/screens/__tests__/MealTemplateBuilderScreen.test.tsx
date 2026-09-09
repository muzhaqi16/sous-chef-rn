'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { MealTemplateBuilderScreen } from '../MealTemplateBuilderScreen';

// Delegate to the real hook and spy on the write: `control` has no
// plain-object equivalent, so a stubbed form renders no Controller at all.
// The form object is patched IN PLACE — replacing it would change its identity
// every render, and the effect under test depends on that identity.
const templateResets: { name?: string }[] = [];
jest.mock('react-hook-form', () => {
  const actual = jest.requireActual('react-hook-form');
  const patched = new WeakSet<object>();
  return {
    ...actual,
    useForm: (...args: unknown[]) => {
      const form = actual.useForm(...args);
      if (!patched.has(form)) {
        patched.add(form);
        const original = form.reset.bind(form);
        form.reset = (values?: { name?: string }) => {
          if (values && 'name' in values) templateResets.push(values);
          return original(values);
        };
      }
      return form;
    },
  };
});

let mockLoadedTemplate: Record<string, unknown> | null = null;
jest.mock('#features/mealPlan/hooks/useMealTemplateForEdit', () => ({
  useMealTemplateForEdit: () => ({ template: mockLoadedTemplate }),
}));

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

  // A cache write emits a NEW data object for the same template, so an effect
  // keyed on the object rehydrates and throws away whatever the user typed.
  it('hydrates once per template, not once per emitted object', () => {
    const template = {
      id: 'tmpl-1',
      name: 'Winter Week',
      category: 'WEEKLY',
      description: '',
      defaultServings: 4,
      tags: [],
      items: [],
    };
    mockLoadedTemplate = template;
    templateResets.length = 0;

    const { rerender } = renderWithApollo(
      <MealTemplateBuilderScreen
        route={{ params: { templateId: 'tmpl-1' } }}
      />,
    );
    const afterFirst = templateResets.length;

    // The same template, a new object — what `cache.modify` produces when a
    // meal is added on this very screen.
    mockLoadedTemplate = { ...template };
    rerender(
      <MealTemplateBuilderScreen
        route={{ params: { templateId: 'tmpl-1' } }}
      />,
    );

    expect(afterFirst).toBe(1);
    expect(templateResets.length).toBe(1);

    // A different template is a different record, and does rehydrate.
    mockLoadedTemplate = { ...template, id: 'tmpl-2', name: 'Summer Week' };
    rerender(
      <MealTemplateBuilderScreen
        route={{ params: { templateId: 'tmpl-2' } }}
      />,
    );

    expect(templateResets.length).toBe(2);
    expect(templateResets[1]?.name).toBe('Summer Week');
    mockLoadedTemplate = null;
  });

  it('renders the edit title when a templateId is provided', () => {
    renderWithApollo(
      <MealTemplateBuilderScreen route={{ params: { templateId: 'tpl-1' } }} />,
    );
    expect(screen.getByText('Edit Template')).toBeTruthy();
  });
});

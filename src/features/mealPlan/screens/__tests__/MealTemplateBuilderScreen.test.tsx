'use no memo';
import React from 'react';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { MealType } from '#/graphql/generated/schemaTypes';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
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

const mockAddItem = jest.fn(async () => true);
const mockUpdateItem = jest.fn(async () => true);
jest.mock('#features/mealPlan/hooks/useMealTemplateEditor', () => ({
  useMealTemplateEditor: jest.fn(() => ({
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    addItem: mockAddItem,
    updateItem: mockUpdateItem,
    removeItem: jest.fn(),
    readRecipeName: (recipeId: string) =>
      recipeId === 'recipe-2' ? 'Pesto Pasta' : '',
    creating: false,
    updating: false,
  })),
}));

interface PickerProps {
  onAddRecipe: (recipeId: string, mealType: MealType) => void;
}
const pickerRenders: PickerProps[] = [];
jest.mock('#features/mealPlan/components/AddMealSheet', () => ({
  AddMealSheet: (props: PickerProps) => {
    pickerRenders.push(props);
    return null;
  },
}));

const pickRecipe = (recipeId: string, mealType: MealType) => {
  const picker = pickerRenders[pickerRenders.length - 1];
  if (!picker) throw new Error('the recipe picker never rendered');
  act(() => picker.onAddRecipe(recipeId, mealType));
};

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

  describe('recipe-backed items', () => {
    const RECIPE_TEMPLATE = {
      id: 'tmpl-r',
      name: 'Pasta Week',
      category: 'WEEKLY',
      description: '',
      defaultServings: 2,
      tags: [],
      items: [
        {
          id: 'item-1',
          dayOffset: 0,
          mealType: MealType.Dinner,
          customMealName: null,
          servings: 2,
          notes: null,
          recipe: {
            id: 'recipe-1',
            name: 'Carbonara',
            imageUrl: null,
            servings: 4,
            totalTimeMinutes: 25,
          },
        },
      ],
    };

    beforeEach(() => {
      mockAddItem.mockClear();
      mockUpdateItem.mockClear();
      pickerRenders.length = 0;
    });

    afterEach(() => {
      mockLoadedTemplate = null;
    });

    // Sending `meal: { customMealName }` for an untouched recipe row replaced
    // its recipe on the server.
    it('saves an edited recipe item without replacing its recipe', async () => {
      const user = userEvent.setup();
      mockLoadedTemplate = RECIPE_TEMPLATE;
      renderWithApollo(
        <MealTemplateBuilderScreen
          route={{ params: { templateId: 'tmpl-r' } }}
        />,
      );

      expect(screen.getByText('Carbonara')).toBeTruthy();
      await user.press(
        screen.getByTestId(mealPlanTestIDs.templateItemRow('item-1')),
      );
      expect(
        screen.getByTestId(mealPlanTestIDs.templateItemRecipe),
      ).toBeTruthy();

      await user.press(
        screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
      );

      await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(1));
      expect(mockUpdateItem).toHaveBeenCalledWith({
        id: 'item-1',
        dayOffset: 0,
        mealType: MealType.Dinner,
        servings: 2,
      });
    });

    it('adds a saved recipe to a slot by its id', async () => {
      const user = userEvent.setup();
      mockLoadedTemplate = RECIPE_TEMPLATE;
      renderWithApollo(
        <MealTemplateBuilderScreen
          route={{ params: { templateId: 'tmpl-r' } }}
        />,
      );

      pickRecipe('recipe-2', MealType.Lunch);
      expect(screen.getByText('Pesto Pasta')).toBeTruthy();

      await user.press(
        screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
      );

      await waitFor(() => expect(mockAddItem).toHaveBeenCalledTimes(1));
      expect(mockAddItem).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'tmpl-r',
          mealType: MealType.Lunch,
          meal: { recipeId: 'recipe-2' },
        }),
      );
    });

    it('lists a picked recipe as a draft row under its name', async () => {
      const user = userEvent.setup();
      renderWithApollo(
        <MealTemplateBuilderScreen route={{ params: undefined }} />,
      );

      pickRecipe('recipe-2', MealType.Dinner);
      await user.press(
        screen.getByTestId(mealPlanTestIDs.templateSubmitItemButton),
      );

      await waitFor(() =>
        expect(screen.queryByText('No meals added yet')).toBeNull(),
      );
      expect(screen.getByText('Pesto Pasta')).toBeTruthy();
      expect(
        screen.queryByTestId(mealPlanTestIDs.templateItemRecipe),
      ).toBeNull();
    });
  });
});

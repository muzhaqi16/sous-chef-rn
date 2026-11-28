import React from 'react';
import { TextInput } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#i18n';
import { Button } from '#components/molecules/Button';
import type { RecipeFormState } from '#features/recipes/types';
import { useRecipeForm } from '#features/recipes/screens/RecipeForm/useRecipeForm';
import { RecipeBasicFields } from '../RecipeBasicFields';

const onValid = jest.fn<void, [RecipeFormState]>();

/** The real form, as the recipe screen holds it, with its save. */
function Harness() {
  const form = useRecipeForm();
  return (
    <>
      <RecipeBasicFields control={form.control} />
      <Button
        title={t('labels.save')}
        onPress={() => {
          void form.handleSubmit(onValid)();
        }}
      />
    </>
  );
}

const save = () =>
  userEvent
    .setup()
    .press(screen.getByRole('button', { name: t('labels.save') }));

const nameInput = () =>
  screen.getByPlaceholderText(t('recipes.namePlaceholder'));

// React Native's mock gives every TextInput one shared `focus`; the instance
// it was called on names the input.
const focusedPlaceholder = (): unknown => {
  const focus = jest.mocked(TextInput.prototype.focus);
  const [last] = focus.mock.contexts.slice(-1) as Array<
    { props: { placeholder?: string } } | undefined
  >;
  return last?.props.placeholder;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecipeBasicFields', () => {
  it('names its fields', () => {
    render(<Harness />);
    expect(nameInput()).toBeOnTheScreen();
    expect(screen.getByText(t('labels.servings'))).toBeOnTheScreen();
    expect(screen.getByText(t('recipes.prepTimeMin'))).toBeOnTheScreen();
    expect(screen.getByText(t('recipes.cookTimeMin'))).toBeOnTheScreen();
  });

  it('says on the name that it is needed, and takes the cook to it', async () => {
    render(<Harness />);

    await save();

    expect(screen.getByText(t('recipes.nameRequired'))).toBeOnTheScreen();
    expect(focusedPlaceholder()).toBe(t('recipes.namePlaceholder'));
    expect(onValid).not.toHaveBeenCalled();
  });

  it('clears the name message once a name is typed', async () => {
    render(<Harness />);
    await save();

    await userEvent.setup().type(nameInput(), 'Pasta');

    expect(nameInput()).toHaveDisplayValue('Pasta');
    expect(screen.queryByText(t('recipes.nameRequired'))).toBeNull();
  });
});

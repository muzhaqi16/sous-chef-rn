import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#i18n';
import type { StepFormState } from '#features/recipes/types';
import {
  RecipeStepEditor,
  type RecipeStepEditorRef,
} from '../RecipeStepEditor';

jest.mock('#utils/generateId', () => ({ generateId: () => 'test-id' }));

const onSave = jest.fn();

const renderEditor = (step?: StepFormState) => {
  const ref = React.createRef<RecipeStepEditorRef>();
  render(<RecipeStepEditor ref={ref} onSave={onSave} />);
  act(() => ref.current?.open(step));
  return ref;
};

const instruction = () =>
  screen.getByPlaceholderText(t('recipes.stepInstructionPlaceholder'));
const save = () =>
  userEvent.setup().press(screen.getByLabelText(t('labels.save')));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecipeStepEditor', () => {
  it('adds a step as typed, trimmed', async () => {
    renderEditor();
    expect(screen.getByText(t('recipes.addStep'))).toBeTruthy();
    fireEvent.changeText(instruction(), '  Whisk the eggs  ');
    await save();
    expect(onSave).toHaveBeenCalledWith({
      id: 'temp-step-test-id',
      instruction: 'Whisk the eggs',
      sortOrder: 0,
    });
  });

  it('asks for the instruction on the field when saved without one', async () => {
    renderEditor();
    await save();
    expect(
      screen.getByText(t('recipes.instructionRequired')),
    ).toBeOnTheScreen();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('edits a step under its own id', async () => {
    renderEditor({ id: 'step-3', instruction: 'Boil water', sortOrder: 2 });
    expect(screen.getByText(t('recipes.editStep'))).toBeTruthy();
    expect(instruction()).toHaveDisplayValue('Boil water');
    fireEvent.changeText(instruction(), 'Boil salted water');
    await save();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'step-3',
        instruction: 'Boil salted water',
      }),
    );
  });

  it('opens fresh: what was typed and its error go with the closing', async () => {
    const ref = renderEditor();
    fireEvent.changeText(instruction(), '  ');
    await save();
    expect(
      screen.getByText(t('recipes.instructionRequired')),
    ).toBeOnTheScreen();

    act(() => ref.current?.close());
    act(() => ref.current?.open());

    expect(instruction()).toHaveDisplayValue('');
    expect(screen.queryByText(t('recipes.instructionRequired'))).toBeNull();
  });
});

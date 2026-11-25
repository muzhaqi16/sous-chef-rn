import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#i18n';
import { EditableField } from '../EditableField';

const renderField = (onSave: (value: string) => Promise<string | null>) =>
  render(<EditableField label="Home name" value="Casa" onSave={onSave} />);

const rename = async (to: string) => {
  const user = userEvent.setup();
  await user.press(screen.getByLabelText(t('labels.edit')));
  const field = screen.getByDisplayValue('Casa');
  await user.clear(field);
  await user.type(field, to);
  await user.press(screen.getByText(t('labels.save')));
};

// A rename the server refuses keeps what was typed, with the reason on it.
describe('EditableField', () => {
  it('stays open on a refused value, its reason on the field', async () => {
    const saved = Promise.resolve('That name is taken');
    renderField(() => saved);

    await rename('Home');
    await act(() => saved);

    expect(screen.getByText('That name is taken')).toBeVisible();
    expect(screen.getByDisplayValue('Home')).toBeVisible();
  });

  it('closes once the value is saved', async () => {
    const saved = Promise.resolve(null);
    renderField(() => saved);

    await rename('Home');
    await act(() => saved);

    expect(screen.queryByText(t('labels.save'))).toBeNull();
  });
});

import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#i18n';
import { alertService } from '#services/alertService';
import { DIETARY_LIMITS } from '#domain/dietary';
import { CookingPreferencesSheet } from '#features/profile/components/CookingPreferencesSheet/CookingPreferencesSheet';

const onClose = jest.fn();
const onSave = jest.fn(() => Promise.resolve(true));

type Stored = { maxCookTimeMinutes?: number | null };

const sheet = (props: { visible?: boolean; initialValues?: Stored } = {}) => (
  <CookingPreferencesSheet
    visible
    onClose={onClose}
    onSave={onSave}
    initialValues={{}}
    {...props}
  />
);

const cookTime = () =>
  screen.getByPlaceholderText(t('cookingPreferences.cookTimePlaceholder'));
const save = () =>
  userEvent.setup().press(screen.getByLabelText(t('labels.save')));
const OUT_OF_RANGE = () =>
  t('cookingPreferences.cookTimeRange', DIETARY_LIMITS.cookTime);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CookingPreferencesSheet', () => {
  it('asks only for the longest cooking time', () => {
    render(sheet());
    expect(screen.getByText(t('labels.cookingPreferences'))).toBeTruthy();
    expect(cookTime()).toBeTruthy();
  });

  it('opens on the stored limit', () => {
    render(sheet({ initialValues: { maxCookTimeMinutes: 60 } }));
    expect(cookTime()).toHaveDisplayValue('60');
  });

  it('saves a cook time typed in', async () => {
    render(sheet());
    fireEvent.changeText(cookTime(), '40');
    await save();
    expect(onSave).toHaveBeenCalledWith({ maxCookTimeMinutes: 40 });
  });

  // The API reads null as "clear it", so an emptied limit is removed, not kept.
  it('clears a limit emptied from its stored value', async () => {
    render(sheet({ initialValues: { maxCookTimeMinutes: 60 } }));
    fireEvent.changeText(cookTime(), '');
    await save();
    expect(onSave).toHaveBeenCalledWith({ maxCookTimeMinutes: null });
  });

  it('sends nothing for a limit left blank', async () => {
    render(sheet());
    await save();
    expect(onSave).toHaveBeenCalledWith({});
  });

  it('says on the field that a time is out of range, not in an alert', async () => {
    render(sheet());
    fireEvent.changeText(cookTime(), String(DIETARY_LIMITS.cookTime.max + 1));
    await save();
    expect(screen.getByText(OUT_OF_RANGE())).toBeOnTheScreen();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('says a refused save failed, and stays open on what was typed', async () => {
    onSave.mockResolvedValueOnce(false);
    render(sheet());
    fireEvent.changeText(cookTime(), '40');
    await save();
    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('cookingPreferences.updateFailed'),
    );
    expect(cookTime()).toHaveDisplayValue('40');
  });

  it('opens fresh: what was typed and its error go with the closing', async () => {
    const view = render(sheet({ initialValues: { maxCookTimeMinutes: 60 } }));
    fireEvent.changeText(cookTime(), String(DIETARY_LIMITS.cookTime.max + 1));
    await save();
    expect(screen.getByText(OUT_OF_RANGE())).toBeOnTheScreen();

    view.rerender(
      sheet({ visible: false, initialValues: { maxCookTimeMinutes: 60 } }),
    );
    view.rerender(sheet({ initialValues: { maxCookTimeMinutes: 60 } }));

    expect(cookTime()).toHaveDisplayValue('60');
    expect(screen.queryByText(OUT_OF_RANGE())).toBeNull();
  });
});

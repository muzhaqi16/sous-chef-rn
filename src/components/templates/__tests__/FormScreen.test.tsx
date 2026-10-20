import React from 'react';
import { render } from '@testing-library/react-native';
import { usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#platform/presenters';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { t } from '#/i18n';
import { FormScreen } from '../FormScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));
// The guard is the subject; the header and scroll host are not.
jest.mock('../Screen', () => ({
  Screen: ({ children }: { children?: React.ReactNode }) => children,
}));

const renderForm = (unsavedChanges?: boolean) =>
  render(
    <FormScreen
      title="Edit"
      onClose={jest.fn()}
      onSave={jest.fn()}
      unsavedChanges={unsavedChanges}
    >
      {null}
    </FormScreen>,
  );

/** What the guard does when leaving is attempted: the alert's buttons. */
const attemptLeave = (action: NavigationAction): AlertButton[] => {
  const [, callback] = jest.mocked(usePreventRemove).mock.lastCall ?? [];
  if (!callback) throw new Error('the guard was not mounted');
  callback({ data: { action } });
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  return buttons ?? [];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FormScreen unsaved changes', () => {
  it('does not guard a form that has not opted in', () => {
    renderForm();
    expect(usePreventRemove).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'holds leaving back while unsavedChanges is %s',
    unsaved => {
      renderForm(unsaved);
      expect(jest.mocked(usePreventRemove).mock.lastCall?.[0]).toBe(unsaved);
    },
  );

  it('asks before discarding, and leaves only on Discard', () => {
    renderForm(true);
    const action: NavigationAction = { type: 'GO_BACK' };

    const [cancel, discard] = attemptLeave(action);

    expect(alertService.alert).toHaveBeenCalledWith(
      t('confirmations.discardChangesTitle'),
      t('confirmations.discardChanges'),
      expect.any(Array),
    );
    const { navigation } = useAppNavigation();
    cancel?.onPress?.();
    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(discard?.text).toBe(t('labels.discard'));
    discard?.onPress?.();
    expect(navigation.dispatch).toHaveBeenCalledWith(action);
  });
});

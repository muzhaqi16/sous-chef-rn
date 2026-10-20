import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import { useLanguagePreference } from '../useLanguagePreference';

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ language: 'en' });
});

describe('useLanguagePreference', () => {
  it('switches the language at once and saves it to the account', async () => {
    const update = recordMock(UpdateUserPreferencesDocument, {
      data: {
        updateSettings: {
          __typename: 'UpdateSettingsPayload',
          userSettings: { __typename: 'UserSettings', id: 'settings-1' },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useLanguagePreference(), {
      operationMocks: [update.mock],
    });

    act(() => {
      result.current.selectLanguage('fr');
    });

    expect(useStore.getState().language).toBe('fr');
    await waitFor(() =>
      expect(update.fired).toEqual([
        { input: { regional: { language: 'fr' } } },
      ]),
    );
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('alerts a refused save', async () => {
    const update = recordMock(UpdateUserPreferencesDocument, {
      data: {
        updateSettings: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'regional.language',
        },
      },
    });
    const { result } = renderHookWithApollo(() => useLanguagePreference(), {
      operationMocks: [update.mock],
    });

    act(() => {
      result.current.selectLanguage('fr');
    });

    await waitFor(() => expect(alertService.alert).toHaveBeenCalledTimes(1));
  });
});

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { ErrorCode } from '#graphql/generated/schemaTypes';
import { alertService } from '#services/alertService';
import { useStore } from '#store';
import { useLanguagePreference } from '../useLanguagePreference';

const saved = () =>
  recordMock(UpdateUserPreferencesDocument, {
    data: {
      updateSettings: {
        __typename: 'UpdateSettingsPayload',
        userSettings: { __typename: 'UserSettings', id: 'settings-1' },
      },
    },
  });

/** What the offline queue resolves a held write with: no payload, no error. */
const queued = () =>
  recordMock(UpdateUserPreferencesDocument, {
    data: { updateSettings: null },
  });

/** `once` answers the first send only, as a refusal of that write alone. */
const refused = ({ once = false } = {}) =>
  recordMock(UpdateUserPreferencesDocument, {
    ...(once && { held: true, maxUsageCount: 1 }),
    data: {
      updateSettings: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        field: 'regional.language',
      },
    },
  });

const render = (...answers: ReturnType<typeof recordMock>[]) =>
  renderHookWithApollo(() => useLanguagePreference(), {
    operationMocks: answers.map(answer => answer.mock),
  }).result;

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ language: 'en' });
});

describe('useLanguagePreference', () => {
  it('switches the language at once and saves it to the account', async () => {
    const update = saved();
    const result = render(update);

    await act(async () => {
      const saving = result.current.selectLanguage('fr');
      expect(useStore.getState().language).toBe('fr');
      await saving;
    });

    expect(update.fired).toEqual([{ input: { regional: { language: 'fr' } } }]);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('keeps a change the queue holds', async () => {
    const result = render(queued());

    await act(async () => {
      await result.current.selectLanguage('fr');
    });

    expect(useStore.getState().language).toBe('fr');
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('puts back a refused language and says so', async () => {
    const result = render(refused());

    await act(async () => {
      await result.current.selectLanguage('fr');
    });

    expect(useStore.getState().language).toBe('en');
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });

  it('leaves a later pick standing when an earlier one is refused', async () => {
    const first = refused({ once: true });
    const result = render(first, queued());

    // The later write goes out once the earlier one is answered.
    await act(async () => {
      const both = Promise.all([
        result.current.selectLanguage('fr'),
        result.current.selectLanguage('de'),
      ]);
      first.release();
      await both;
    });

    expect(useStore.getState().language).toBe('de');
  });
});

import { act, renderHook } from '@testing-library/react-native';
import { useStore } from '#store';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useNewFeatureTour } from '../useNewFeatureTour';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

const RELEASED = '2026-10-20T00:00:00Z';

const signIn = (createdAt?: string) =>
  act(() => {
    useStore.setState({
      user: {
        id: 'u1',
        email: 'someone@example.com',
        emailVerified: true,
        onBoarded: true,
        ...(createdAt ? { createdAt } : {}),
      },
    });
  });

const allowed = () =>
  renderHook(() =>
    useNewFeatureTour({ introducedOn: RELEASED, flag: 'storeMode' }),
  ).result.current;

beforeEach(() => {
  jest.mocked(useFeatureFlag).mockReturnValue(true);
});

describe('useNewFeatureTour', () => {
  it('An existing user updates: the feature’s tour may show', () => {
    signIn('2026-09-01T12:00:00Z');
    expect(allowed()).toBe(true);
  });

  it('An account kept from before its creation was recorded counts as existing', () => {
    signIn();
    expect(allowed()).toBe(true);
  });

  it('A new account after the release: the tour does not show', () => {
    signIn('2026-11-01T12:00:00Z');
    expect(allowed()).toBe(false);
  });

  it('The feature is switched off: its tour never shows', () => {
    signIn('2026-09-01T12:00:00Z');
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    expect(allowed()).toBe(false);
  });
});

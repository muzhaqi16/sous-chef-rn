import { act, waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { FeatureFlagName } from '#/graphql/generated/schemaTypes';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import { useUser } from '#store/useAppStore';
import { useFeatureFlag } from '../useFeatureFlag';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#store/useAppStore', () => ({
  ...jest.requireActual('#store/useAppStore'),
  useUser: jest.fn(() => ({ id: 'user-1' })),
}));

const flags = (states: { flag: FeatureFlagName; enabled: boolean }[]) =>
  recordMock(MyFeatureFlagsDocument, {
    data: {
      myFeatureFlags: states.map(
        ({
          flag,
          enabled,
        }): {
          __typename: 'FeatureFlagState';
          flag: FeatureFlagName;
          enabled: boolean;
        } => ({
          __typename: 'FeatureFlagState',
          flag,
          enabled,
        }),
      ),
    },
  });

beforeEach(() => {
  jest
    .mocked(useUser)
    .mockReturnValue({ id: 'user-1' } as ReturnType<typeof useUser>);
});

describe('useFeatureFlag', () => {
  it('is on where the server turns it on for this user', async () => {
    const { result } = renderHookWithApollo(
      () => useFeatureFlag('recipeCaptureUrl'),
      {
        operationMocks: [
          flags([{ flag: FeatureFlagName.RecipeCaptureUrl, enabled: true }])
            .mock,
        ],
      },
    );

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is off where the server turns it off', async () => {
    const answer = flags([
      { flag: FeatureFlagName.RecipeCaptureUrl, enabled: false },
    ]);
    const { result } = renderHookWithApollo(
      () => useFeatureFlag('recipeCaptureUrl'),
      { operationMocks: [answer.mock] },
    );

    await waitFor(() => expect(answer.fired).toHaveLength(1));
    expect(result.current).toBe(false);
  });

  it('keeps its last answer through a re-read that fails', async () => {
    const answered = flags([
      { flag: FeatureFlagName.RecipeCaptureUrl, enabled: true },
    ]);
    const failed = recordMock(MyFeatureFlagsDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderHookWithApollo(
      () => ({
        enabled: useFeatureFlag('recipeCaptureUrl'),
        client: useApolloClient(),
      }),
      { operationMocks: [{ ...answered.mock, maxUsageCount: 1 }, failed.mock] },
    );
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => {
      await result.current.client
        .refetchQueries({ include: [MyFeatureFlagsDocument] })
        .catch(() => undefined);
    });

    expect(failed.fired).toHaveLength(1);
    expect(result.current.enabled).toBe(true);
  });

  it('is off before the server has answered', () => {
    const { result } = renderHookWithApollo(
      () => useFeatureFlag('ingredientPaste'),
      { operationMocks: [] },
    );

    expect(result.current).toBe(false);
  });

  it('asks nothing while signed out, and offers nothing', () => {
    jest.mocked(useUser).mockReturnValue(null);
    const answer = flags([
      { flag: FeatureFlagName.IngredientPaste, enabled: true },
    ]);

    const { result } = renderHookWithApollo(
      () => useFeatureFlag('ingredientPaste'),
      { operationMocks: [answer.mock] },
    );

    expect(answer.fired).toEqual([]);
    expect(result.current).toBe(false);
  });
});

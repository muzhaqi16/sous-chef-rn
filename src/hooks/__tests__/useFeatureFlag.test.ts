import { waitFor } from '@testing-library/react-native';
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
      () => useFeatureFlag('recipeCapture'),
      {
        operationMocks: [
          flags([{ flag: FeatureFlagName.RecipeCapture, enabled: true }]).mock,
        ],
      },
    );

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is off where the server turns it off', async () => {
    const answer = flags([
      { flag: FeatureFlagName.RecipeCapture, enabled: false },
    ]);
    const { result } = renderHookWithApollo(
      () => useFeatureFlag('recipeCapture'),
      { operationMocks: [answer.mock] },
    );

    await waitFor(() => expect(answer.fired).toHaveLength(1));
    expect(result.current).toBe(false);
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

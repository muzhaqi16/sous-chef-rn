import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  Diet,
  HealthGoal,
  Intolerance,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { HomeDietaryNeedsDocument } from '#features/home/hooks/useHomeDietaryNeeds.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import type { RootState } from '#store/index';
import { operationLog } from '#/test-utils/operationLog';
import { useHeldRestrictions } from '../useHeldRestrictions';

jest.mock('#store/useAppStore', () => {
  const getState = () => ({ user: { id: 'user-1' } } as Partial<RootState>);
  return {
    useAppStore: jest.fn(
      <T>(selector: (state: RootState) => T): T =>
        selector(getState() as RootState),
    ),
    useUser: () => getState().user,
    useUserId: () => getState().user?.id,
  };
});

const restriction = (
  id: string,
  fields: {
    diet?: Diet;
    intolerance?: Intolerance;
    healthGoal?: HealthGoal;
  },
) => ({
  id,
  diet: fields.diet ?? null,
  intolerance: fields.intolerance ?? null,
  healthGoal: fields.healthGoal ?? null,
  item: null,
  severity: RestrictionSeverity.Preference,
});

describe('useHeldRestrictions', () => {
  it('names each restriction once, own and shared, and no health goal', async () => {
    const own = recordMock(GetDietaryProfileDocument, {
      data: {
        me: {
          id: 'user-1',
          dietaryProfile: {
            id: 'profile-1',
            userId: 'user-1',
            restrictions: [
              restriction('r-veg', { diet: Diet.Vegetarian }),
              restriction('r-goal', { healthGoal: HealthGoal.LowCarb }),
            ],
          },
        },
      },
    });
    const shared = recordMock(HomeDietaryNeedsDocument, {
      data: {
        home: {
          id: 'home-1',
          dietaryNeeds: [
            {
              membership: { id: 'm-2', userId: 'user-2' },
              restrictions: [
                restriction('r-veg-2', { diet: Diet.Vegetarian }),
                restriction('r-peanut', { intolerance: Intolerance.Peanut }),
              ],
            },
          ],
        },
      },
    });
    const log = operationLog();
    const { result } = renderHookWithApollo(
      () => useHeldRestrictions('home-1'),
      { operationMocks: [own.mock, shared.mock], links: [log.link] },
    );

    // Each read is awaited by its own answer, never a clock.
    await act(async () => {
      await log.answered(GetDietaryProfileDocument);
      await log.answered(HomeDietaryNeedsDocument);
    });

    expect(result.current).toEqual({
      restrictions: [
        { diet: Diet.Vegetarian, intolerance: null, item: null },
        { diet: null, intolerance: Intolerance.Peanut, item: null },
      ],
      complete: true,
    });
  });
});

import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  HealthGoal,
  Intolerance,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { HomeDietaryNeedsDocument } from '#features/home/hooks/useHomeDietaryNeeds.generated';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import type { RootState } from '#store/index';
import { useRestrictionsInPlay } from '../useRestrictionsInPlay';

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

interface Restriction {
  id: string;
  diet: null;
  intolerance: Intolerance | null;
  healthGoal: HealthGoal | null;
  item: null;
  severity: RestrictionSeverity;
}

const peanutAllergy: Restriction = {
  id: 'r-peanut',
  diet: null,
  intolerance: Intolerance.Peanut,
  healthGoal: null,
  item: null,
  severity: RestrictionSeverity.Allergy,
};
const lowCarbGoal: Restriction = {
  id: 'r-goal',
  diet: null,
  intolerance: null,
  healthGoal: HealthGoal.LowCarb,
  item: null,
  severity: RestrictionSeverity.Goal,
};

const ownProfile = (restrictions: Restriction[] | null) =>
  recordMock(GetDietaryProfileDocument, {
    data: {
      me: {
        id: 'user-1',
        dietaryProfile: restrictions
          ? { id: 'profile-1', userId: 'user-1', restrictions }
          : null,
      },
    },
  });

const homeNeeds = (restrictions: Restriction[]) =>
  recordMock(HomeDietaryNeedsDocument, {
    data: {
      home: {
        id: 'home-1',
        dietaryNeeds: restrictions.length
          ? [{ membership: { id: 'm-2', userId: 'user-2' }, restrictions }]
          : [],
      },
    },
  });

const render = (...mocks: ReturnType<typeof recordMock>[]) =>
  renderHookWithApollo(() => useRestrictionsInPlay('home-1'), {
    operationMocks: mocks.map(m => m.mock),
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRestrictionsInPlay', () => {
  it('is in play with the user’s own restriction', async () => {
    const { result } = render(ownProfile([peanutAllergy]), homeNeeds([]));
    await drainTimers();
    expect(result.current).toBe(true);
  });

  it('is in play with only a member’s shared restriction', async () => {
    const { result } = render(ownProfile(null), homeNeeds([peanutAllergy]));
    await drainTimers();
    expect(result.current).toBe(true);
  });

  it('is not in play when the only restriction is a health goal', async () => {
    const { result } = render(ownProfile([lowCarbGoal]), homeNeeds([]));
    await drainTimers();
    expect(result.current).toBe(false);
  });

  it('is not in play with no restriction anywhere', async () => {
    const { result } = render(ownProfile(null), homeNeeds([]));
    await drainTimers();
    expect(result.current).toBe(false);
  });

  it('is unknown while a read has not answered', async () => {
    const failedNeeds = recordMock(HomeDietaryNeedsDocument, {
      error: new Error('Network request failed'),
    });
    const noProfile = ownProfile(null);
    const { result } = render(noProfile, failedNeeds);

    await drainTimers();

    expect(noProfile.fired).toHaveLength(1);
    expect(failedNeeds.fired).toHaveLength(1);
    expect(result.current).toBeNull();
  });
});

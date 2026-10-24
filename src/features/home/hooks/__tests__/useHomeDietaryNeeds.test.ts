import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  Intolerance,
  MembershipRole,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { HomeDietaryNeedsDocument } from '../useHomeDietaryNeeds.generated';
import { useHomeDietaryNeeds } from '../useHomeDietaryNeeds';

const needsMock = (
  dietaryNeeds: {
    membership: {
      id: string;
      userId: string;
      role: MembershipRole;
      displayName: string | null;
    };
    restrictions: {
      id: string;
      diet: null;
      intolerance: Intolerance | null;
      healthGoal: null;
      severity: RestrictionSeverity;
    }[];
  }[],
) =>
  recordMock(HomeDietaryNeedsDocument, {
    data: { home: { id: 'home-1', dietaryNeeds } },
  });

describe('useHomeDietaryNeeds', () => {
  it('names each sharing member with their restrictions, worded', async () => {
    const { result } = renderHookWithApollo(
      () => useHomeDietaryNeeds('home-1'),
      {
        operationMocks: [
          needsMock([
            {
              membership: {
                id: 'm-ana',
                userId: 'u-ana',
                role: MembershipRole.Member,
                displayName: 'Ana',
              },
              restrictions: [
                {
                  id: 'r-1',
                  diet: null,
                  intolerance: Intolerance.Peanut,
                  healthGoal: null,
                  severity: RestrictionSeverity.Allergy,
                },
              ],
            },
          ]).mock,
        ],
      },
    );

    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.members).toEqual([
      {
        membershipId: 'm-ana',
        userId: 'u-ana',
        role: MembershipRole.Member,
        displayName: 'Ana',
        restrictions: [
          {
            id: 'r-1',
            labelKey: 'recipes.intolerance.PEANUT',
            severity: RestrictionSeverity.Allergy,
          },
        ],
      },
    ]);
  });

  it('is empty, not failed, when nobody shares', async () => {
    const { result } = renderHookWithApollo(
      () => useHomeDietaryNeeds('home-1'),
      { operationMocks: [needsMock([]).mock] },
    );

    await waitFor(() => expect(result.current.state).toBe('empty'));
    expect(result.current.members).toEqual([]);
  });
});

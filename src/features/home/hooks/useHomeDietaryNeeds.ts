import { useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  RestrictionSeverity,
  type MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { restrictionLabel } from '#domain/dietary';
import { useDataState } from '#hooks/data/useDataState';
import { HomeDietaryNeedsDocument } from './useHomeDietaryNeeds.generated';

/**
 * What a need asks of the cook: a food avoided at its severity, a diet
 * followed, a goal aimed at.
 */
export type NeedGroup =
  | 'allergicTo'
  | 'intolerantTo'
  | 'avoids'
  | 'follows'
  | 'goals';

/** Strictest first: the order a cook reads them. */
const GROUP_ORDER: readonly NeedGroup[] = [
  'allergicTo',
  'intolerantTo',
  'avoids',
  'follows',
  'goals',
];

export interface DietaryNeed {
  id: string;
  /** Worded to show. */
  label: string;
  severity: RestrictionSeverity;
}

/** One member who shares with the home, and what the home sees of them. */
export interface MemberDietaryNeeds {
  membershipId: string;
  userId: string;
  role: MembershipRole;
  displayName: string | null;
  /** Only the groups the member holds, in `GROUP_ORDER`. */
  groups: { group: NeedGroup; needs: DietaryNeed[] }[];
}

function groupOf(restriction: {
  diet: unknown;
  healthGoal: unknown;
  severity: RestrictionSeverity;
}): NeedGroup {
  if (restriction.diet) return 'follows';
  if (restriction.healthGoal) return 'goals';
  switch (restriction.severity) {
    case RestrictionSeverity.Allergy:
      return 'allergicTo';
    case RestrictionSeverity.Intolerance:
      return 'intolerantTo';
    case RestrictionSeverity.Preference:
    case RestrictionSeverity.Goal:
      return 'avoids';
  }
}

/**
 * What a home's members cannot or will not eat, read live from each sharing
 * member. Cache and network: it opens offline from the last visit and is fresh
 * on every visit, so a member who left or stopped sharing is gone.
 */
export function useHomeDietaryNeeds(homeId: string) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useQuery(HomeDietaryNeedsDocument, {
    variables: { homeId },
  });

  const members: MemberDietaryNeeds[] = (data?.home?.dietaryNeeds ?? []).map(
    ({ membership, restrictions }) => ({
      membershipId: membership.id,
      userId: membership.userId,
      role: membership.role,
      displayName: membership.displayName,
      groups: GROUP_ORDER.map(group => ({
        group,
        needs: restrictions
          .filter(restriction => groupOf(restriction) === group)
          .map(restriction => ({
            id: restriction.id,
            label: restrictionLabel(restriction, t),
            severity: restriction.severity,
          })),
      })).filter(({ needs }) => needs.length > 0),
    }),
  );

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: members.length === 0,
  });

  return {
    members,
    state,
    retry: () => {
      void refetch();
    },
  };
}

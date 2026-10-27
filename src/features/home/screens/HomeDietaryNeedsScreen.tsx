import React from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { SubScreen } from '#components/templates/SubScreen';
import { RowCard } from '#components/atoms/RowCard';
import { Badge, type BadgeVariant } from '#components/atoms/Badge';
import { Text } from '#components/atoms/Text';
import { DataStateView } from '#components/organisms/DataStateView';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { useUser } from '#store/useAppStore';
import { getMemberDisplayName } from '#/utils/formatters/memberFormatters';
import {
  useHomeDietaryNeeds,
  type MemberDietaryNeeds,
} from '#features/home/hooks/useHomeDietaryNeeds';
import { homeTestIDs } from '#features/home/testIDs';

/**
 * Each heading says what its badges ask: a food is avoided at its severity, a
 * diet followed, a goal aimed at. Strictest first: the order a cook reads them.
 */
type NeedGroup = 'allergicTo' | 'intolerantTo' | 'avoids' | 'follows' | 'goals';

const GROUP_ORDER: readonly NeedGroup[] = [
  'allergicTo',
  'intolerantTo',
  'avoids',
  'follows',
  'goals',
];

const GROUP_LABEL_KEYS: Record<NeedGroup, TranslationKey> = {
  allergicTo: 'homeDietaryNeeds.group.allergicTo',
  intolerantTo: 'homeDietaryNeeds.group.intolerantTo',
  avoids: 'homeDietaryNeeds.group.avoids',
  follows: 'homeDietaryNeeds.group.follows',
  goals: 'homeDietaryNeeds.group.goals',
};

function groupOf({
  kind,
  severity,
}: MemberDietaryNeeds['restrictions'][number]): NeedGroup {
  if (kind === 'diet') return 'follows';
  if (kind === 'goal') return 'goals';
  switch (severity) {
    case RestrictionSeverity.Allergy:
      return 'allergicTo';
    case RestrictionSeverity.Intolerance:
      return 'intolerantTo';
    case RestrictionSeverity.Preference:
    case RestrictionSeverity.Goal:
      return 'avoids';
  }
}

const SEVERITY_BADGE: Record<RestrictionSeverity, BadgeVariant> = {
  [RestrictionSeverity.Allergy]: 'danger',
  [RestrictionSeverity.Intolerance]: 'warning',
  [RestrictionSeverity.Preference]: 'default',
  [RestrictionSeverity.Goal]: 'primary',
};

type HomeDietaryNeedsScreenProps = StaticScreenProps<{ homeId: string }>;

/** What each member who shares with a home cannot or will not eat, by name. */
export const HomeDietaryNeedsScreen: React.FC<HomeDietaryNeedsScreenProps> = ({
  route,
}) => {
  const { homeId } = route.params;
  const { t } = useTranslation();
  const currentUser = useUser();
  const { members, state, retry } = useHomeDietaryNeeds(homeId);

  const nameOf = (member: MemberDietaryNeeds) =>
    getMemberDisplayName(
      {
        id: member.membershipId,
        role: member.role,
        displayName: member.displayName,
        user: { id: member.userId },
      },
      t,
      currentUser?.id,
    );

  return (
    <SubScreen
      title={t('homeDietaryNeeds.title')}
      testID={homeTestIDs.dietaryNeedsScreen}
    >
      <DataStateView
        state={state}
        onRetry={retry}
        empty={{
          icon: 'nutrition-outline',
          title: t('homeDietaryNeeds.emptyTitle'),
          description: t('homeDietaryNeeds.emptyBody'),
        }}
      />
      {state === 'ready' && (
        <View style={styles.list}>
          {members.map(member => (
            <RowCard
              key={member.membershipId}
              testID={homeTestIDs.dietaryNeedsMember(member.membershipId)}
            >
              <View style={[commonStyles.rowSurface, commonStyles.rowContent]}>
                <View style={styles.column}>
                  <Text role={rowType.title}>{nameOf(member)}</Text>
                  {GROUP_ORDER.map(group => {
                    const held = member.restrictions.filter(
                      restriction => groupOf(restriction) === group,
                    );
                    if (held.length === 0) return null;
                    return (
                      <View key={group} style={commonStyles.rowTextGap}>
                        <Text role={rowType.subtitle} tone="secondary">
                          {t(GROUP_LABEL_KEYS[group])}
                        </Text>
                        <View style={styles.badges}>
                          {held.map(restriction => (
                            <Badge
                              key={restriction.id}
                              variant={SEVERITY_BADGE[restriction.severity]}
                            >
                              {restriction.label}
                            </Badge>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </RowCard>
          ))}
        </View>
      )}
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    paddingTop: theme.spacing.md,
  },
  column: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
}));

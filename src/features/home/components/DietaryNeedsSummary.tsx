import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { Badge, type BadgeVariant } from '#components/atoms/Badge';
import { Text } from '#components/atoms/Text';
import { rowType } from '#/theme/foundations/type';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import type {
  MemberDietaryNeeds,
  NeedGroup,
} from '#features/home/hooks/useHomeDietaryNeeds';

const GROUP_LABEL_KEYS: Record<NeedGroup, TranslationKey> = {
  allergicTo: 'homeDietaryNeeds.group.allergicTo',
  intolerantTo: 'homeDietaryNeeds.group.intolerantTo',
  avoids: 'homeDietaryNeeds.group.avoids',
  follows: 'homeDietaryNeeds.group.follows',
  goals: 'homeDietaryNeeds.group.goals',
};

const SEVERITY_BADGE: Record<RestrictionSeverity, BadgeVariant> = {
  [RestrictionSeverity.Allergy]: 'danger',
  [RestrictionSeverity.Intolerance]: 'warning',
  [RestrictionSeverity.Preference]: 'neutral',
  [RestrictionSeverity.Goal]: 'primary',
};

/**
 * A member's needs as one wrapping run: each group's word, then its foods. The
 * word carries the meaning; the badge colour only repeats it.
 */
export const DietaryNeedsSummary: React.FC<{
  groups: MemberDietaryNeeds['groups'];
}> = ({ groups }) => {
  const { t } = useTranslation();

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabelOf(
        ...groups.map(
          ({ group, needs }) =>
            `${t(GROUP_LABEL_KEYS[group])} ${needs
              .map(need => need.label)
              .join(', ')}`,
        ),
      )}
      style={styles.run}
    >
      {groups.map(({ group, needs }) => (
        <View key={group} style={styles.group}>
          <Text role={rowType.subtitle} tone="secondary">
            {t(GROUP_LABEL_KEYS[group])}
          </Text>
          {needs.map(need => (
            <Badge key={need.id} variant={SEVERITY_BADGE[need.severity]}>
              {need.label}
            </Badge>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  run: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: theme.spacing.md,
    rowGap: theme.spacing.xs,
  },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: '100%',
  },
}));

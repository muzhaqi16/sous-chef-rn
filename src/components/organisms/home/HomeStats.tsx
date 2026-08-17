import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import Animated, {
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { TIMING } from '#constants/animations';
import { Icon, type IconName } from '#/utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface HomeStatsProps {
  totalHomes: number;
  totalMembers: number;
  totalPantries: number;
}

export const HomeStats: React.FC<HomeStatsProps> = ({
  totalHomes,
  totalMembers,
  totalPantries,
}) => {
  const { t } = useTranslation();

  // Gentle staggered entrance so the stat row eases in alongside the home
  // cards below (which already use FadeInDown), instead of snapping in.
  // Disabled under the OS "reduce motion" setting.
  const reducedMotion = useReducedMotion();

  // Each stat carries a recognizable icon so the cards read as a designed
  // dashboard row rather than three bare numbers. The icon sits in a soft
  // tinted badge (same treatment as EmptyState) and the glyph uses the brand
  // accent, so it adapts to the user's chosen brand color.
  const stats: { key: string; icon: IconName; value: number; label: string }[] =
    [
      {
        key: 'homes',
        icon: 'home-outline',
        value: totalHomes,
        label: t('homeManagement.statsHome', { count: totalHomes }),
      },
      {
        key: 'members',
        icon: 'people-outline',
        value: totalMembers,
        label: t('homeManagement.statsMember', { count: totalMembers }),
      },
      {
        key: 'pantries',
        icon: 'basket-outline',
        value: totalPantries,
        label: t('homeManagement.statsPantry', { count: totalPantries }),
      },
    ];

  return (
    <View style={styles.statsContainer}>
      {stats.map((stat, index) => (
        <Animated.View
          key={stat.key}
          entering={
            reducedMotion
              ? undefined
              : FadeInDown.delay(index * 60).duration(TIMING.STANDARD)
          }
          style={[commonStyles.shadow, styles.statCard]}
        >
          <View style={styles.iconBadge}>
            <Icon name={stat.icon} size={18} tone="primary" />
          </View>
          <Text size="2xl" weight="bold" tone="accent">
            {stat.value}
          </Text>
          <Text size="xs" tone="secondary" style={styles.statLabel}>
            {stat.label}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  statsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing['3'],
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  statLabel: {
    marginTop: theme.spacing.xs,
  },
}));

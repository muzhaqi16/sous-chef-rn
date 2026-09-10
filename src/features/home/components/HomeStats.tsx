import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, type IconName } from '#/utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { motion } from '#/theme/foundations/motion';
import { Card } from '#components/atoms/Card';

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
          style={styles.statCardSlot}
          entering={FadeInDown.delay(index * 60).duration(
            motion.timing.STANDARD,
          )}
        >
          <Card padding="none" style={styles.statCard}>
            <View style={styles.iconBadge}>
              <Icon name={stat.icon} size={18} tone="primary" />
            </View>
            <Text role="title" tone="accent">
              {stat.value}
            </Text>
            <Text role="caption" tone="secondary" style={styles.statLabel}>
              {stat.label}
            </Text>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  statsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.base,
  },
  // The animated wrapper is what the row lays out, so the third goes HERE. On
  // the Card it collapsed the wrapper to its icon and spilled the value and
  // label outside the card.
  statCardSlot: {
    flex: 1,
  },
  statCard: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
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

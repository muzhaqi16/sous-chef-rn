import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useFragment } from '@apollo/client/react';
import { useIncompleteCellReport } from '#/hooks/apollo/useIncompleteCellReport';

import { Icon } from '#components/atoms/Icon';
import { HomeActions } from './HomeActions';
import { MembersList } from './MembersList';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { hitSlop } from '#/theme/foundations/sizes';
import { homeTestIDs } from '#features/home/testIDs';
import { Text } from '#components/atoms/Text';
import { HomeCard_HomeFragmentDoc } from './HomeCard.generated';
import { motion } from '#/theme/motion';

interface HomeCardProps {
  homeId: string;
  isDefault: boolean;
  /** The home this device is on; a default it is not on offers the switch back. */
  isCurrent: boolean;
  isHighlighted?: boolean;
  canInvite?: boolean;
  canDelete?: boolean;
  onPress?: (homeId: string) => void;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string, homeName: string) => void;
}

export const HomeCard: React.FC<HomeCardProps> = ({
  homeId,
  isDefault,
  isCurrent,
  isHighlighted = false,
  canInvite,
  canDelete,
  onPress,
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  const { t } = useTranslation();
  // Per-entity cache subscription: this card re-renders only when this Home's
  // fields change. `GetHomes` fetches them through `home_listed`.
  const {
    data: home,
    complete,
    missing,
  } = useFragment({
    fragment: HomeCard_HomeFragmentDoc,
    fragmentName: 'HomeCard_home',
    from: { __typename: 'Home', id: homeId },
  });
  useIncompleteCellReport('HomeCard_home', missing);

  // Animated value for highlight effect
  const highlightOpacity = useSharedValue(0);

  // Trigger highlight animation when isHighlighted changes
  useLayoutEffect(() => {
    highlightOpacity.set(
      withTiming(isHighlighted ? 1 : 0, {
        duration: motion.timing.FAST,
        easing: motion.easing.gentle,
      }),
    );
  }, [isHighlighted, highlightOpacity]);

  const animatedTheme = useAnimatedTheme();

  // Opacity animates; the brand colour is read in the worklet because the
  // animated node takes no themed style.
  const animatedHighlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.get(),
    backgroundColor: animatedTheme.get().colors.primaryLight,
  }));

  if (!complete) return null;

  const memberCount = home.membersConnection.totalCount;
  const pantryCount = home.pantriesConnection.totalCount;
  const members = home.membersConnection.edges.map(e => e.node);
  const invites = home.invitesConnection.edges.map(e => e.node);

  const handleDelete = () => {
    onDelete(home.id, home.name);
  };

  return (
    <View style={styles.homeCardWrapper}>
      <View style={styles.card}>
        {/* Highlight overlay - opacity animates; brand color is set in the worklet */}
        <Animated.View
          style={[styles.highlightOverlay, animatedHighlightStyle]}
        />

        <Pressable
          style={({ pressed }) => [
            styles.homeHeader,
            pressed && onPress && styles.pressed,
          ]}
          onPress={() => onPress?.(home.id)}
          accessibilityRole="button"
          accessibilityLabel={`${home.name}, ${t('labels.memberCount', {
            count: memberCount,
          })}, ${t('joinHome.pantryCount', {
            count: pantryCount,
          })}${
            isDefault ? t('homeManagement.accessibilityDefaultSuffix') : ''
          }`}
          accessibilityHint={t('homeManagement.accessibilityHint')}
          disabled={!onPress}
        >
          <View style={styles.homeInfo}>
            <Text role="heading">{home.name}</Text>

            <Text role="caption" tone="secondary" style={styles.homeDetails}>
              {t('labels.memberCount', { count: memberCount })} •{' '}
              {t('joinHome.pantryCount', { count: pantryCount })}
            </Text>
          </View>
          {isDefault && isCurrent ? (
            <View style={styles.defaultBadge}>
              <Text role="label" tone="onPrimaryLight">
                {t('homeManagement.cardDefault')}
              </Text>
            </View>
          ) : (
            <AppPressable
              onPress={() => onSetDefault(home.id)}
              hitSlop={hitSlop.lg}
              accessibilityRole="button"
              accessibilityLabel={t('labels.setDefault')}
              testID={homeTestIDs.setDefaultButton(home.id)}
            >
              <Icon name="star-outline" size={22} tone="textSecondary" />
            </AppPressable>
          )}
          {!!onPress && (
            <Icon name="chevron-forward" size={20} tone="textSecondary" />
          )}
        </Pressable>

        <HomeActions
          homeId={home.id}
          canInvite={canInvite}
          canDelete={canDelete}
          onInvite={onInvite}
          onDelete={handleDelete}
        />

        <MembersList members={members} invites={invites} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
  homeCardWrapper: {
    marginVertical: theme.spacing.sm,
    // borderRadius needed for shadow to follow card shape
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    ...theme.shadows.card,
  },
  highlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // backgroundColor comes from `animatedHighlightStyle`.
    pointerEvents: 'none',
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.base,
    gap: theme.spacing.md,
  },
  homeInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  homeDetails: {
    marginTop: theme.spacing.xs,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

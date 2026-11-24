import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View, type ViewStyle } from 'react-native';
import { useTranslation } from '#/i18n';
import Animated, {
  useAnimatedStyle,
  type CSSTransitionProperties,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useFragment } from '@apollo/client/react';
import { useIncompleteCellReport } from '#/hooks/apollo/useIncompleteCellReport';

import { Icon } from '#components/atoms/Icon';
import { MembersList } from './MembersList';
import { Pressable } from '#components/atoms/themedComponents';
import { homeTestIDs } from '#features/home/testIDs';
import { Text } from '#components/atoms/Text';
import { HomeCard_HomeFragmentDoc } from './HomeCard.generated';
import { motion } from '#/theme/motion';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';

const LIT: ViewStyle = { opacity: 1 };
const UNLIT: ViewStyle = { opacity: 0 };

const FADE: CSSTransitionProperties = {
  transitionProperty: 'opacity',
  transitionDuration: motion.timing.FAST,
  transitionTimingFunction: motion.cssEasing.gentle,
};

interface HomeCardProps {
  homeId: string;
  isDefault: boolean;
  /** The home this device is on; a default it is not on offers the switch back. */
  isCurrent: boolean;
  isHighlighted?: boolean;
  canInvite: boolean;
  onPress?: (homeId: string) => void;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
}

export const HomeCard: React.FC<HomeCardProps> = ({
  homeId,
  isDefault,
  isCurrent,
  isHighlighted = false,
  canInvite,
  onPress,
  onSetDefault,
  onInvite,
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

  // Reanimated's CSS transitions ignore reduce motion.
  // Verified: #reanimated-css-transitions-ignore-reduce-motion.
  const motionEnabled = useMotionEnabled();
  const animatedTheme = useAnimatedTheme();

  // The opacity transitions; the brand colour is read in a theme-only worklet
  // because the animated node takes no themed style.
  const highlightThemeStyle = useAnimatedStyle(() => ({
    backgroundColor: animatedTheme.get().colors.primaryLight,
  }));

  if (!complete) return null;

  const memberCount = home.membersConnection.totalCount;
  const pantryCount = home.pantriesConnection.totalCount;
  const members = home.membersConnection.edges.map(e => e.node);
  const invites = home.invitesConnection.edges.map(e => e.node);

  return (
    <View style={styles.homeCardWrapper}>
      <View style={styles.card}>
        <Animated.View
          style={[
            styles.highlightOverlay,
            highlightThemeStyle,
            isHighlighted ? LIT : UNLIT,
            motionEnabled ? FADE : null,
          ]}
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
            <IconButton
              name="star-outline"
              size="md"
              tone="textSecondary"
              onPress={() => onSetDefault(home.id)}
              accessibilityLabel={t('labels.setDefault')}
              accessibilityRole="button"
              testID={homeTestIDs.setDefaultButton(home.id)}
            />
          )}
          {!!onPress && (
            <Icon name="chevron-forward" size="sm" tone="textSecondary" />
          )}
        </Pressable>

        <MembersList
          members={members}
          invites={invites}
          onInvite={canInvite ? () => onInvite(home.id) : undefined}
        />
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
    // backgroundColor comes from `highlightThemeStyle`.
    pointerEvents: 'none',
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import { useFragment } from '@apollo/client/react';
import { type FragmentType } from '@apollo/client/masking';
import { TIMING } from '#constants/animations';
import { Icon } from '#utils/iconUtils';
import { HomeActions } from './HomeActions';
import { MembersList } from './MembersList';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { HomeCard_HomeFragmentDoc } from './HomeCard.generated';

interface HomeCardProps {
  homeRef: FragmentType<typeof HomeCard_HomeFragmentDoc>;
  isDefault: boolean;
  isHighlighted?: boolean;
  canInvite?: boolean;
  canDelete?: boolean;
  onPress?: (homeId: string) => void;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string, homeName: string) => void;
}

export const HomeCard: React.FC<HomeCardProps> = ({
  homeRef,
  isDefault,
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
  // fields change.
  const { data: home, complete } = useFragment({
    fragment: HomeCard_HomeFragmentDoc,
    fragmentName: 'HomeCard_home',
    from: homeRef,
  });

  // Animated value for highlight effect
  const highlightOpacity = useSharedValue(0);

  // Trigger highlight animation when isHighlighted changes
  useLayoutEffect(() => {
    highlightOpacity.set(
      withTiming(isHighlighted ? 1 : 0, {
        duration: TIMING.FAST,
        easing: Easing.out(Easing.ease),
      }),
    );
  }, [isHighlighted, highlightOpacity]);

  const animatedTheme = useAnimatedTheme();

  // Animated highlight overlay - opacity animates; the brand color is read in
  // the worklet (not interpolated) so Reanimated is the sole writer of this
  // node. If the color lived on the static stylesheet, a Reanimated commit
  // could land over a freshly-applied theme color and pin the overlay to the
  // previous brand color until remount.
  const animatedHighlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.get(),
    backgroundColor: animatedTheme.get().colors.primary + '15',
  }));

  if (!complete) return null;

  const memberCount = home.membersConnection?.totalCount ?? 0;
  const pantryCount = home.pantriesConnection?.totalCount ?? 0;
  const members =
    home.membersConnection?.edges?.map(e => e.node).filter(Boolean) ?? [];
  const invites =
    home.invitesConnection?.edges?.map(e => e.node).filter(Boolean) ?? [];

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
          accessibilityLabel={`${home.name}, ${t('joinHome.memberCount', {
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
            <Text size="lg" weight="semibold">
              {home.name}
            </Text>

            <Text size="sm" tone="secondary" style={styles.homeDetails}>
              {t('joinHome.memberCount', { count: memberCount })} •{' '}
              {t('joinHome.pantryCount', { count: pantryCount })}
            </Text>
          </View>
          {!!isDefault && (
            <View style={styles.defaultBadge}>
              <Text size="xs" weight="semibold" tone="accent">
                {t('homeManagement.cardDefault')}
              </Text>
            </View>
          )}
          {!!onPress && (
            <Icon name="chevron-forward" size={20} tone="textSecondary" />
          )}
        </Pressable>

        <HomeActions
          homeId={home.id}
          isDefault={isDefault}
          canInvite={canInvite}
          canDelete={canDelete}
          onSetDefault={onSetDefault}
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
    marginHorizontal: theme.spacing.md,
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
    // backgroundColor is driven by the worklet in `animatedHighlightStyle` — see
    // the note there; the brand color must not live on the static stylesheet of
    // a node Reanimated also commits to.
    pointerEvents: 'none',
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing['3'],
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
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

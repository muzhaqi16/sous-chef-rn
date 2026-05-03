import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TIMING } from '#constants/animations';
import { Icon } from '#utils/iconUtils';
import { HomeActions } from './HomeActions';
import { MembersList } from './MembersList';
import { Pressable } from 'react-native-gesture-handler';
import type { Member } from '#/utils/formatters/memberFormatters';
import { Text } from '#components/atoms/Text';

export type PartialHome = {
  id: string;
  name: string;
  joinCode?: string;
  allowJoinCode?: boolean;
  membersTotalCount?: number;
  pantriesTotalCount?: number;
  members?: Member[];
  pantries?: Array<{ id: string }>;
  invites?: Array<{
    id: string;
    email: string | null;
    recipientName: string | null;
    status: string;
  }>;
  myMembership?: Member | null;
};

interface HomeCardProps {
  home: PartialHome;
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
  home,
  isDefault,
  isHighlighted = false,
  canInvite,
  canDelete,
  onPress,
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  const { theme } = useUnistyles();

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

  // Static card style - backgroundColor doesn't animate
  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    overflow: 'hidden',
  };

  // Animated highlight overlay - only opacity animates
  const animatedHighlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.get(),
  }));

  const handleDelete = () => {
    onDelete(home.id, home.name);
  };

  // Wrapper pattern: static Unistyles on outer View for margin/shadow,
  // static card style with animated highlight overlay for smooth animation
  return (
    <View style={styles.homeCardWrapper}>
      <View style={cardStyle}>
        {/* Highlight overlay - only opacity animates, no color interpolation */}
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
          accessibilityLabel={`${home.name}, ${
            home.membersTotalCount ?? home.members?.length ?? 0
          } ${
            (home.membersTotalCount ?? home.members?.length ?? 0) === 1
              ? 'member'
              : 'members'
          }, ${home.pantriesTotalCount ?? home.pantries?.length ?? 0} ${
            (home.pantriesTotalCount ?? home.pantries?.length ?? 0) === 1
              ? 'pantry'
              : 'pantries'
          }${isDefault ? ', default home' : ''}`}
          accessibilityHint="Tap to view home details"
          disabled={!onPress}
        >
          <View style={styles.homeInfo}>
            <Text size="lg" weight="semibold">
              {home.name}
            </Text>

            <Text size="sm" tone="secondary" style={styles.homeDetails}>
              {home.membersTotalCount ?? home.members?.length ?? 0}{' '}
              {(home.membersTotalCount ?? home.members?.length ?? 0) === 1
                ? 'member'
                : 'members'}{' '}
              • {home.pantriesTotalCount ?? home.pantries?.length ?? 0}{' '}
              {(home.pantriesTotalCount ?? home.pantries?.length ?? 0) === 1
                ? 'pantry'
                : 'pantries'}
            </Text>
          </View>
          {!!isDefault && (
            <View style={styles.defaultBadge}>
              <Text size="xs" weight="semibold" tone="accent">
                Default
              </Text>
            </View>
          )}
          {!!onPress && (
            <Icon
              name="chevron-forward"
              size={20}
              color={theme.colors.textSecondary}
            />
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

        <MembersList
          members={home.members || []}
          invites={home.invites || []}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeCardWrapper: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    // borderRadius needed for shadow to follow card shape
    borderRadius: theme.radii.md,
    // Shadow styles
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 15,
        spreadDistance: 1,
        color: theme.colors.black + '1A',
      },
    ],
  },
  highlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary + '15',
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
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

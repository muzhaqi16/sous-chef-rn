import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { HomeActions } from './HomeActions';
import { MembersList } from './MembersList';
import { HomeInviteFragment } from '#generated';

export type PartialHome = {
  id: string;
  name: string;
  joinCode?: string;
  allowJoinCode?: boolean;
  members?: Array<{
    id: string;
    role: string;
    status: string;
    userId?: string;
    displayName?: string;
    user?: {
      id: string;
      email?: string;
      profile?: {
        firstName?: string;
        lastName?: string;
        displayName?: string;
      };
    };
  }>;
  pantries?: Array<{ id: string }>;
  invites?: HomeInviteFragment[];
  myMembership?: {
    id: string;
    role: string;
    status: string;
    displayName?: string;
    canManageHome?: boolean;
  } | null;
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
  useEffect(() => {
    highlightOpacity.value = withTiming(isHighlighted ? 1 : 0, {
      duration: 150, // Fast - matches slide animation
      easing: Easing.out(Easing.ease),
    });
  }, [isHighlighted, highlightOpacity]);

  // Static card style - backgroundColor doesn't animate
  const cardStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    overflow: 'hidden' as const,
  };

  // Animated highlight overlay - only opacity animates
  const animatedHighlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
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

        <TouchableOpacity
          style={styles.homeHeader}
          onPress={() => onPress?.(home.id)}
          activeOpacity={onPress ? 0.7 : 1}
          accessibilityRole="button"
          accessibilityLabel={`${home.name}, ${home.members?.length || 0} ${
            (home.members?.length || 0) === 1 ? 'member' : 'members'
          }, ${home.pantries?.length || 0} ${
            (home.pantries?.length || 0) === 1 ? 'pantry' : 'pantries'
          }${isDefault ? ', default home' : ''}`}
          accessibilityHint="Tap to view home details"
          disabled={!onPress}
        >
          <View style={styles.homeInfo}>
            <Text style={styles.homeName}>{home.name}</Text>

            <Text style={styles.homeDetails}>
              {home.members?.length || 0}{' '}
              {(home.members?.length || 0) === 1 ? 'member' : 'members'} •{' '}
              {home.pantries?.length || 0}{' '}
              {(home.pantries?.length || 0) === 1 ? 'pantry' : 'pantries'}
            </Text>
          </View>
          {isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
          {onPress && (
            <Icon
              name="chevron-forward"
              size={20}
              color={theme.colors.textSecondary}
              library="Ionicons"
            />
          )}
        </TouchableOpacity>

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
  homeName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  homeDetails: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  defaultText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
}));

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { HomeActions } from './HomeActions';
import { MembersList } from './MembersList';
import { commonStyles } from '#/styles';
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

  // Animated values for highlight effect
  const highlightOpacity = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.05);
  const scale = useSharedValue(1);

  // Trigger highlight animation when isHighlighted changes
  useEffect(() => {
    if (isHighlighted) {
      // Animate in
      highlightOpacity.value = withSpring(1, {
        damping: 25,
        stiffness: 200,
        mass: 1.2,
      });
      shadowOpacity.value = withSpring(0.2, {
        damping: 25,
        stiffness: 200,
        mass: 1.2,
      });
      scale.value = withSpring(1.02, {
        damping: 30,
        stiffness: 180,
        mass: 1.5,
      });
    } else {
      // Animate out
      highlightOpacity.value = withSpring(0, {
        damping: 25,
        stiffness: 200,
        mass: 1.2,
      });
      shadowOpacity.value = withSpring(0.05, {
        damping: 25,
        stiffness: 200,
        mass: 1.2,
      });
      scale.value = withSpring(1, {
        damping: 30,
        stiffness: 180,
        mass: 1.5,
      });
    }
  }, [isHighlighted, highlightOpacity, shadowOpacity, scale]);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      shadowOpacity: shadowOpacity.value,
    };
  });

  const animatedHighlightStyle = useAnimatedStyle(() => {
    return {
      opacity: highlightOpacity.value,
    };
  });

  const handleDelete = () => {
    onDelete(home.id, home.name);
  };

  return (
    <Animated.View style={[commonStyles.shadow, styles.homeCard, animatedCardStyle]}>
      <Animated.View style={[styles.highlightOverlay, animatedHighlightStyle]} />
      <TouchableOpacity
        style={styles.homeHeader}
        onPress={() => onPress?.(home.id)}
        activeOpacity={onPress ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`${home.name}, ${home.members?.length || 0} members, ${home.pantries?.length || 0} pantries${isDefault ? ', default home' : ''}`}
        accessibilityHint="Tap to view home details"
        disabled={!onPress}
      >
        <View style={styles.homeInfo}>
          <Text style={styles.homeName}>{home.name}</Text>

          <Text style={styles.homeDetails}>
            {home.members?.length || 0} members • {home.pantries?.length || 0}{' '}
            pantries
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

      <MembersList members={home.members || []} invites={home.invites || []} />
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeCard: {
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  highlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: theme.radii.md,
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

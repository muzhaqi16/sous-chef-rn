import React, { useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import type { GreetingHeaderProps } from './types';

/**
 * Generic greeting header with user info, optional household badge, and search
 *
 * @example
 * // Pantry - with household badge
 * <GreetingHeader
 *   userName="John"
 *   avatarUrl={profile?.avatar}
 *   notificationCount={3}
 *   onAvatarPress={() => navigate('Notifications')}
 *   household={{ name: "Smith Family", onPress: () => navigate('HomeManagement') }}
 *   search={{ placeholder: "Search pantry...", value, onChangeText }}
 *   onSettingsPress={openPantrySelector}
 * />
 *
 * // Shopping List - no household badge
 * <GreetingHeader
 *   userName="John"
 *   search={{ placeholder: "Search items...", value, onChangeText }}
 *   rightActions={<AddButton />}
 * />
 */
export const GreetingHeader: React.FC<GreetingHeaderProps> = ({
  userName,
  avatarInitial,
  avatarUrl,
  notificationCount = 0,
  onAvatarPress,
  household,
  search,
  settingsIcon = '⚙️',
  onSettingsPress,
  rightActions,
  variant = 'default',
  testIDPrefix = 'greeting-header',
}) => {
  const { theme } = useUnistyles();

  const handleClearSearch = useCallback(() => {
    if (search?.onClear) {
      search.onClear();
    } else if (search) {
      search.onChangeText('');
    }
  }, [search]);

  const displayInitial = avatarInitial || userName.charAt(0).toUpperCase();
  const isCompact = variant === 'compact';

  return (
    <View
      style={[
        styles.container,
        { paddingTop: isCompact ? 4 : 8 },
      ]}
      testID={testIDPrefix}
    >
      {/* Greeting Row */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingContent}>
          <Text style={[styles.greeting, isCompact && styles.greetingCompact]}>
            Hello, <Text style={styles.userName}>{userName}</Text>!
          </Text>

          {/* Household Badge - Optional */}
          {!!household && (
            <Pressable
              onPress={household.onPress}
              style={styles.householdBadge}
              testID={`${testIDPrefix}-household`}
            >
              <Text style={styles.homeEmoji}>{household.icon || '🏠'}</Text>
              <Text style={styles.householdName}>{household.name}</Text>
              {!!household.onPress && <Icon name="chevron-forward" size={14} color={theme.colors.textTertiary} />}
            </Pressable>
          )}
        </View>

        {/* Avatar */}
        <Pressable
          onPress={onAvatarPress}
          style={styles.avatarContainer}
          testID={`${testIDPrefix}-avatar`}
        >
          {avatarUrl ? (
            <CachedImage uri={avatarUrl} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayInitial}</Text>
            </View>
          )}
          {notificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search Bar - Optional */}
      {!!search && (
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={search.placeholder}
            placeholderTextColor={theme.colors.textTertiary}
            value={search.value}
            onChangeText={search.onChangeText}
            testID={`${testIDPrefix}-search`}
          />
          {search.value.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Icon name="close" size={20} color={theme.colors.textTertiary} />
            </Pressable>
          ) : rightActions ? (
            rightActions
          ) : onSettingsPress ? (
            <Pressable
              onPress={onSettingsPress}
              hitSlop={8}
              testID={`${testIDPrefix}-settings`}
            >
              <Text style={styles.settingsIcon}>{settingsIcon}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  greetingContent: {
    flex: 1,
  },
  greeting: {
    fontSize: theme.typography.fontSize['2xl'] + 2,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  greetingCompact: {
    fontSize: theme.typography.fontSize.xl + 2,
  },
  userName: {
    color: theme.colors.primary,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs + 2,
  },
  homeEmoji: {
    fontSize: theme.typography.fontSize.xs,
  },
  householdName: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: theme.sizes.avatar.lg,
    height: theme.sizes.avatar.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  avatarImage: {
    width: theme.sizes.avatar.lg,
    height: theme.sizes.avatar.lg,
    borderRadius: theme.radii.lg,
    ...theme.shadows.md,
  },
  avatarText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
  notificationBadge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    width: theme.sizes.icon.sm,
    height: theme.sizes.icon.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  notificationCount: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
  },
  searchIcon: {
    fontSize: theme.typography.fontSize.md,
    marginRight: theme.spacing.sm + 2,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  settingsIcon: {
    fontSize: theme.typography.fontSize.lg,
    marginLeft: theme.spacing.sm + 2,
  },
}));

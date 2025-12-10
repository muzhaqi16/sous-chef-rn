import React, { useCallback } from 'react';
import { View, Text, TextInput, Pressable, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '#utils';
import type { GreetingHeaderProps } from './types';

export type {
  GreetingHeaderProps,
  HouseholdBadgeConfig,
  SearchConfig,
} from './types';

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
  const insets = useSafeAreaInsets();

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
        { paddingTop: insets.top + (isCompact ? 4 : 8) },
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
          {household && (
            <Pressable
              onPress={household.onPress}
              style={styles.householdBadge}
              testID={`${testIDPrefix}-household`}
            >
              <Text style={styles.homeEmoji}>{household.icon || '🏠'}</Text>
              <Text style={styles.householdName}>{household.name}</Text>
              {household.onPress && (
                <Icon name="chevron-right" size={14} color="#9CA3AF" />
              )}
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
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
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
      {search && (
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: theme.fonts.weight.bold,
    color: '#1F2937',
  },
  greetingCompact: {
    fontSize: 22,
  },
  userName: {
    color: '#F97316',
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  homeEmoji: {
    fontSize: 12,
  },
  householdName: {
    fontSize: 14,
    color: '#6B7280',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(249, 115, 22, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
    shadowColor: 'rgba(249, 115, 22, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: theme.fonts.weight.bold,
    color: '#FFFFFF',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationCount: {
    fontSize: 11,
    fontWeight: theme.fonts.weight.bold,
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    padding: 0,
  },
  settingsIcon: {
    fontSize: 18,
    marginLeft: 10,
  },
}));

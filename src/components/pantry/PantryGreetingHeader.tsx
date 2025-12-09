import React, { useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

interface PantryGreetingHeaderProps {
  userName: string;
  householdName: string;
  avatarInitial: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAvatarPress?: () => void;
  onSettingsPress?: () => void;
}

export const PantryGreetingHeader: React.FC<PantryGreetingHeaderProps> = ({
  userName,
  householdName,
  avatarInitial,
  searchQuery,
  onSearchChange,
  onAvatarPress,
  onSettingsPress,
}) => {
  const { theme } = useUnistyles();

  const handleClearSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <View style={styles.container}>
      {/* Greeting Row */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingContent}>
          <Text style={styles.greeting}>
            Hello, <Text style={styles.userName}>{userName}</Text>!
          </Text>
          <View style={styles.householdBadge}>
            <Icon
              name="location-on"
              size={14}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.householdName}>{householdName}</Text>
          </View>
        </View>

        {/* Avatar */}
        <Pressable onPress={onAvatarPress} style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.avatar.gradientStart }]}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={theme.colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your pantry..."
          placeholderTextColor={theme.colors.textTertiary}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={handleClearSearch} hitSlop={8}>
            <Icon name="close" size={20} color={theme.colors.textTertiary} />
          </Pressable>
        ) : (
          <Pressable onPress={onSettingsPress} hitSlop={8}>
            <Icon name="settings" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
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
    fontSize: 26,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
  },
  userName: {
    color: theme.colors.filterTab.activeBg,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  householdName: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  avatarContainer: {
    shadowColor: theme.colors.avatar.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.filterTab.inactiveBg,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    padding: 0,
  },
}));

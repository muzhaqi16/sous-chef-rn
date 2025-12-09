import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

interface ExpiredBannerProps {
  count: number;
  onPress: () => void;
}

export const ExpiredBanner: React.FC<ExpiredBannerProps> = ({
  count,
  onPress,
}) => {
  const { theme } = useUnistyles();

  if (count <= 0) {
    return null;
  }

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚠️</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          {count} item{count > 1 ? 's' : ''} expired
        </Text>
        <Text style={styles.subtitle}>Tap to review and remove</Text>
      </View>

      <Icon
        name="chevron-right"
        size={24}
        color={theme.colors.expiration.expiredText}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingRight: 16,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.expiration.expiredBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.expiration.expiredBorder,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.expiration.expiredIconBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.expiration.expiredText,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 1,
  },
}));

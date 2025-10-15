import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, IconLibrary } from '#utils';

interface HeaderAction {
  icon: string;
  onPress: () => void;
  color?: string;
  library?: IconLibrary;
}

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  actions?: HeaderAction[];
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  actions = [],
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.header}>
      <View style={styles.backButton}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <Icon name="arrow-back" size={theme.sizes.icon.md} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.actions}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            onPress={action.onPress}
            style={styles.iconButton}
          >
            <Icon
              library={action.library}
              name={action.icon}
              size={theme.sizes.icon.md}
              color={action.color || theme.colors.textPrimary}
            />
          </TouchableOpacity>
        ))}
        {actions.length === 0 && <View style={styles.placeholder} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    width: 40,
    minWidth: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    minWidth: 40,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
}));

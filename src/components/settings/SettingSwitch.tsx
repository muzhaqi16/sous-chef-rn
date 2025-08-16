import React from 'react';
import {View, Text, Switch} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

interface SettingSwitchProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const SettingSwitch: React.FC<SettingSwitchProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}) => {
  const {styles, theme} = useStyles(stylesheet);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, disabled && styles.titleDisabled]}>
          {title}
        </Text>
        {description && (
          <Text
            style={[
              styles.description,
              disabled && styles.descriptionDisabled,
            ]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: theme.colors.border || '#E0E0E0',
          true: theme.colors.primary || '#62B1F6',
        }}
        thumbColor={theme.colors.surface || '#FFFFFF'}
        ios_backgroundColor={theme.colors.border || '#E0E0E0'}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border || '#E0E0E0',
  },
  containerDisabled: {
    opacity: 0.6,
  },
  textContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  titleDisabled: {
    color: theme.colors.textTertiary || '#999',
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  descriptionDisabled: {
    color: theme.colors.textTertiary || '#999',
  },
}));

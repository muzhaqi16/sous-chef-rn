import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon, IconLibrary} from '#utils/iconUtils';

interface ActionButton {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  iconLibrary?: IconLibrary;
}

interface ListActionButtonsProps {
  actions: ActionButton[];
}

export const ListActionButtons: React.FC<ListActionButtonsProps> = ({
  actions,
}) => {
  const {theme} = useUnistyles();

  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}
          onPress={action.onPress}>
          <Icon
            name={action.icon}
            size={20}
            color={action.color || theme.colors.primary}
            library={action.iconLibrary}
          />
          <Text
            style={[
              styles.actionButtonText,
              {color: action.color || theme.colors.primary},
            ]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    marginLeft: theme.spacing['3'],
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
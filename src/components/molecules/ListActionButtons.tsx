import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, IconLibrary } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

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
  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
          onPress={action.onPress}
        >
          <Icon
            name={action.icon}
            size={20}
            color={action.color}
            tone="primary"
            library={action.iconLibrary}
          />
          {action.color ? (
            <Text
              size="md"
              weight="medium"
              style={[styles.actionButtonText, { color: action.color }]}
            >
              {action.label}
            </Text>
          ) : (
            <Text
              size="md"
              weight="medium"
              tone="accent"
              style={styles.actionButtonText}
            >
              {action.label}
            </Text>
          )}
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
    marginLeft: theme.spacing['3'],
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

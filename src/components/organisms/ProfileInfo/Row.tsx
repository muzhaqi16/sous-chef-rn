import { Icon } from '#/utils/iconUtils';
import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';

export interface RowProps {
  label: string;
  value?: string;
  leadingIcon?: React.ReactNode;
  badgeColor?: string;
  onPress?: () => void;
  onSave?: (newValue: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const Row: React.FC<RowProps> = ({
  label,
  value,
  leadingIcon,
  badgeColor,
  onPress,
  onSave,
  isFirst = false,
  isLast = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? '');

  const startEdit = () => {
    if (onSave) {
      setEditing(true);
    } else if (onPress) {
      onPress();
    }
  };

  const handleSave = () => {
    onSave?.(text);
    setEditing(false);
  };

  const handleCancel = () => {
    setText(value ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextInput
          style={styles.editInput}
          value={text}
          onChangeText={setText}
          autoFocus
        />
        <AppPressable onPress={handleSave} style={styles.editIcon}>
          <Icon name="checkmark" size={20} tone="primary" />
        </AppPressable>
        <AppPressable onPress={handleCancel} style={styles.editIcon}>
          <Icon name="close" size={20} tone="error" />
        </AppPressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={startEdit}
      style={({ pressed }) => [
        styles.rowWrapper,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        pressed && (onSave || onPress) && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        {!!leadingIcon && (
          <View style={styles.iconContainer}>{leadingIcon}</View>
        )}

        <Text
          size="md"
          style={leadingIcon ? styles.rowLabelWithIcon : undefined}
        >
          {label}
        </Text>

        <View style={styles.rowSpacer} />

        {value ? (
          <Text
            size="md"
            weight="medium"
            tone="secondary"
            style={[
              styles.rowValue,
              badgeColor ? { color: badgeColor } : undefined,
            ]}
          >
            {value}
          </Text>
        ) : null}

        {!!(onSave || onPress) && (
          <Icon
            name={onSave ? 'pencil' : 'chevron-forward'}
            size={20}
            tone="textSecondary"
          />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rowFirst: {
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
  },
  rowLast: {
    borderBottomLeftRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    height: 48,
  },
  iconContainer: {
    marginRight: theme.spacing['3'],
  },
  rowLabelWithIcon: {
    marginLeft: theme.spacing.xs,
  },
  rowSpacer: {
    flex: 1,
  },
  rowValue: {
    marginRight: theme.spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
  },
  editIcon: {
    marginLeft: theme.spacing['3'],
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

import {Icon} from '#/utils/iconUtils';
import React, {useState} from 'react';
import {Pressable, View, Text, TextInput} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

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
  const {theme} = useUnistyles();
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
        <Pressable onPress={handleSave} style={({pressed}) => [styles.editIcon, pressed && styles.pressed]}>
          <Icon
            library="Feather"
            name="check"
            size={20}
            color={theme.colors.primary}
          />
        </Pressable>
        <Pressable onPress={handleCancel} style={({pressed}) => [styles.editIcon, pressed && styles.pressed]}>
          <Icon
            library="Feather"
            name="x"
            size={20}
            color={theme.colors.error}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={startEdit}
      style={({pressed}) => [
        styles.rowWrapper,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        pressed && (onSave || onPress) && styles.pressed,
      ]}>
      <View style={styles.row}>
        {leadingIcon && <View style={styles.iconContainer}>{leadingIcon}</View>}

        <Text
          style={[
            styles.rowLabel,
            leadingIcon ? styles.rowLabelWithIcon : undefined,
          ]}>
          {label}
        </Text>

        <View style={styles.rowSpacer} />

        {value ? (
          <Text
            style={[
              styles.rowValue,
              badgeColor ? {color: badgeColor} : undefined,
            ]}>
            {value}
          </Text>
        ) : null}

        {(onSave || onPress) && (
          <Icon
            library="Feather"
            name={onSave ? 'edit-2' : 'chevron-right'}
            size={20}
            color={theme.colors.textSecondary}
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
    marginRight: 12,
  },
  rowLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
  },
  rowLabelWithIcon: {
    marginLeft: theme.spacing.xs,
  },
  rowSpacer: {
    flex: 1,
  },
  rowValue: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
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
    paddingHorizontal: 12,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
  },
  editIcon: {
    marginLeft: 12,
  },
  pressed: {
    opacity: 0.7,
  },
}));

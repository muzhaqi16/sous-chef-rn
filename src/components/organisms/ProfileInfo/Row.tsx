import React, {useState} from 'react';
import {TouchableOpacity, View, Text, TextInput} from 'react-native';
import FeatherIcon from '@react-native-vector-icons/feather';
import {StyleSheet} from 'react-native-unistyles';

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
        <TouchableOpacity onPress={handleSave} style={styles.editIcon}>
          <FeatherIcon name="check" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCancel} style={styles.editIcon}>
          <FeatherIcon name="x" size={20} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={startEdit}
      activeOpacity={onSave || onPress ? 0.7 : 1}
      style={[
        styles.rowWrapper,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
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
          <FeatherIcon
            name={onSave ? 'edit-2' : 'chevron-right'}
            size={20}
            color={theme.colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
  },
  iconContainer: {
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  rowLabelWithIcon: {
    marginLeft: 4,
  },
  rowSpacer: {
    flex: 1,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.textPrimary,
  },
  editIcon: {
    marginLeft: 12,
  },
}));

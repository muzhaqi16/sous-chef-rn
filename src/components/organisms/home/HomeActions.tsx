import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

interface HomeActionsProps {
  homeId: string;
  isDefault: boolean;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string) => void;
}

export const HomeActions: React.FC<HomeActionsProps> = ({
  homeId,
  isDefault,
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  const {theme} = useUnistyles();
  return (
    <View style={styles.homeActions}>
      {!isDefault && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onSetDefault(homeId)}>
          <Icon
            name="star-outline"
            size={20}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.actionText}>Set Default</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => onInvite(homeId)}>
        <Icon name="person-add" size={20} color={theme.colors.textSecondary} />
        <Text style={styles.actionText}>Invite</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => onDelete(homeId)}>
        <Icon name="delete" size={20} color={theme.colors.error} />
        <Text style={[styles.actionText, {color: theme.colors.error}]}>
          Delete
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
  },
  actionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
}));

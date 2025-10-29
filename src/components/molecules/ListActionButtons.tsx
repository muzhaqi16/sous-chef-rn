import React from 'react';
import {TouchableOpacity, Text, View} from 'react-native';
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
        <TouchableOpacity
          key={index}
          style={styles.actionButton}
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
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
}));
import React from 'react';
import {Modal, View, Text, TouchableOpacity, ScrollView} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#/utils';

export interface ModalPickerProps {
  label: string;
  visible: boolean;
  options: {label: string; value: string}[];
  selected: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export const ModalPicker: React.FC<ModalPickerProps> = ({
  label,
  visible,
  options,
  selected,
  onSelect,
  onCancel,
}) => {
  const {theme} = useUnistyles();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <TouchableOpacity onPress={onCancel}>
              <Icon
                library="Feather"
                name="x"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={styles.option}
                onPress={() => onSelect(opt.value)}>
                <Text style={styles.optionText}>{opt.label}</Text>
                {selected === opt.value && (
                  <Icon
                    library="Feather"
                    name="check"
                    size={20}
                    color={theme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    maxHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  optionText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
}));

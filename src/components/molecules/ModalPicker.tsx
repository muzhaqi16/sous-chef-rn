import React from 'react';
import {Modal, View, Text, Pressable, ScrollView} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#/utils/iconUtils';

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
            <Pressable onPress={onCancel} style={({pressed}) => pressed && styles.pressed}>
              <Icon
                library="Feather"
                name="x"
                size={24}
                color={theme.colors.textPrimary}
              />
            </Pressable>
          </View>
          <ScrollView>
            {options.map(opt => (
              <Pressable
                key={opt.value}
                style={({pressed}) => [styles.option, pressed && styles.pressed]}
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
              </Pressable>
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
    fontWeight: theme.fonts.weight.semibold,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

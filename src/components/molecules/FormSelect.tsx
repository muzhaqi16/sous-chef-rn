import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  ViewStyle,
  Pressable,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormFieldWrapper } from '../atoms/FormFieldWrapper';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectProps {
  label: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  required?: boolean;
  placeholder?: string;
  containerStyle?: ViewStyle;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  value,
  onValueChange,
  options,
  error,
  required = false,
  placeholder = 'Select an option',
  containerStyle,
}) => {
  const { theme } = useUnistyles();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setModalVisible(false);
  };

  const renderOption = ({ item }: { item: SelectOption }) => {
    const isSelected = item.value === value;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.option,
          isSelected && styles.selectedOption,
          pressed && styles.pressed,
        ]}
        onPress={() => handleSelect(item.value)}
      >
        <Text
          style={[styles.optionText, isSelected && styles.selectedOptionText]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <Pressable
        style={({ pressed }) => [
          styles.selectButton,
          error && styles.selectButtonError,
          pressed && styles.pressed,
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={[
            styles.selectText,
            !selectedOption && styles.selectTextPlaceholder,
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Icon
          name="chevron-down"
          size={24}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {modalVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
          statusBarTranslucent
          navigationBarTranslucent
        >
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{label}</Text>
              <FlatList
                data={options}
                renderItem={renderOption}
                keyExtractor={item => item.value}
                showsVerticalScrollIndicator={false}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  selectButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonError: {
    borderColor: theme.colors.error,
  },
  selectText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  selectTextPlaceholder: {
    color: theme.colors.textSecondary,
  },
  modal: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing['5'],
    maxHeight: '80%',
    width: '90%',
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  option: {
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  selectedOption: {
    backgroundColor: theme.colors.primaryLight,
  },
  optionText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  closeButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radii.md,
    alignSelf: 'center',
  },
  closeButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

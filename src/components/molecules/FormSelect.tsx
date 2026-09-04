import React, { useState } from 'react';
import { View, Modal, ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
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
  placeholder,
  containerStyle,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('formSelect.placeholder');
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setModalVisible(false);
  };

  const renderOption = ({ item }: { item: SelectOption }) => {
    const isSelected = item.value === value;
    return (
      <AppPressable
        style={[styles.option, isSelected && styles.selectedOption]}
        onPress={() => handleSelect(item.value)}
      >
        <Text
          role="bodyStrong"
          style={[styles.optionText, isSelected && styles.selectedOptionText]}
        >
          {item.label}
        </Text>
      </AppPressable>
    );
  };

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <AppPressable
        style={[styles.selectButton, error && styles.selectButtonError]}
        onPress={() => setModalVisible(true)}
      >
        <Text
          role="body"
          style={[
            styles.selectText,
            !selectedOption && styles.selectTextPlaceholder,
          ]}
        >
          {selectedOption ? selectedOption.label : resolvedPlaceholder}
        </Text>
        <Icon name="chevron-down" size={24} tone="textSecondary" />
      </AppPressable>
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
              <Text role="bodyStrong" style={styles.modalTitle}>
                {label}
              </Text>
              <FlashList
                data={options}
                renderItem={renderOption}
                keyExtractor={item => item.value}
                renderScrollComponent={SwipeAwareScrollComponent}
                showsVerticalScrollIndicator={false}
              />
              <AppPressable
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text role="bodyStrong" style={styles.closeButtonText}>
                  {t('labels.close')}
                </Text>
              </AppPressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  selectButton: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonError: {
    borderColor: theme.colors.error,
  },
  selectText: {
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
    borderCurve: 'continuous',
    padding: theme.spacing.mdPlus,
    maxHeight: '80%',
    width: '90%',
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  option: {
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  selectedOption: {
    backgroundColor: theme.colors.primaryLight,
  },
  optionText: {
    color: theme.colors.textPrimary,
  },
  selectedOptionText: {
    color: theme.colors.primary,
  },
  closeButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignSelf: 'center',
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
  },
}));

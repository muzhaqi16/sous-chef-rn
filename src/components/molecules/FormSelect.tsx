import React, { useState } from 'react';
import type { ViewStyle } from 'react-native';
import { useTranslation } from '#i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { FormFieldWrapper } from '../atoms/FormFieldWrapper';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';

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
  const [pickerVisible, setPickerVisible] = useState(false);
  // Inside a sheet, the picker stacks over it; switching would minimize it.
  const inSheet = useIsBottomSheetInput();

  const selectedOption = options.find(option => option.value === value);

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <AppPressable
        style={[styles.selectButton, error && styles.selectButtonError]}
        onPress={() => setPickerVisible(true)}
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
        <Icon name="chevron-down" size="md" tone="textSecondary" />
      </AppPressable>
      <ModalPicker
        label={label}
        visible={pickerVisible}
        options={options}
        selected={value ?? null}
        onSelect={optionValue => {
          onValueChange(optionValue);
          setPickerVisible(false);
        }}
        onCancel={() => setPickerVisible(false)}
        stackBehavior={inSheet ? 'push' : undefined}
      />
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
}));

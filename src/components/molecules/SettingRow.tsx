import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Switch,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { ValueText } from '../atoms/ValueText';
import {
  getInputComponentForField,
  getInputLabelForField,
  getPlaceholderForField,
} from '#utils/inputMapping';
import { getValidationSchemaForField } from '#/utils/validation/profile';
import { Icon } from '#/utils';

export interface SettingRowProps {
  item: any;
  isFirst: boolean;
  isLast: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  item,
  isFirst,
  isLast,
}) => {
  const { theme } = useUnistyles();

  const [modalVisible, setModalVisible] = useState(false);
  const [textEditModalVisible, setTextEditModalVisible] = useState(false);

  // Form setup for text inputs with validation
  const form = useForm({
    resolver: yupResolver(getValidationSchemaForField(item.key)),
    defaultValues: {
      [item.key]: (item.value as string) || '',
    },
  });

  const handlePress = () => {
    if (item.type === 'modal') {
      setModalVisible(true);
    } else if (item.type === 'text') {
      // Reset form with current value and open modal
      form.reset({
        [item.key]: (item.value as string) || '',
      });
      setTextEditModalVisible(true);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  const handleSwitchChange = () => {
    if (item.type !== 'switch') return;
    console.log('Switch changed:', item.key);
    if (item.onPress) {
      item.onPress();
    }
  };

  const handleModalOptionPress = (optionValue: string) => () => {
    if (item.onSave) {
      item.onSave(optionValue);
    }
    setModalVisible(false);
  };

  const handleTextSave = (data: any) => {
    const value = data[item.key];
    if (item.onSave) {
      item.onSave(value);
    }
    setTextEditModalVisible(false);
  };

  const handleTextCancel = () => {
    form.reset();
    setTextEditModalVisible(false);
  };

  // Get the appropriate input component
  const InputComponent = getInputComponentForField(item.key);
  const inputLabel = getInputLabelForField(item.key);
  const placeholder = getPlaceholderForField(item.key);

  // Build accessibility label based on setting type
  const getAccessibilityLabel = () => {
    const baseLabel = item.label;
    if (item.type === 'switch') {
      return `${baseLabel}, ${item.value ? 'enabled' : 'disabled'}`;
    } else if (item.type === 'modal' && item.options) {
      const selectedOption =
        item.options?.find((opt: any) => opt.value === item.value)?.label ||
        'Select';
      return `${baseLabel}, currently ${selectedOption}`;
    } else if (item.type === 'text') {
      return `${baseLabel}, ${item.value || 'not set'}`;
    }
    return baseLabel;
  };

  const getAccessibilityHint = () => {
    if (item.type === 'switch') {
      return `Tap to ${item.value ? 'disable' : 'enable'} ${item.label}`;
    } else if (item.type === 'modal') {
      return 'Tap to select an option';
    } else if (item.type === 'text') {
      return 'Tap to edit';
    } else if (item.type === 'navigation' || item.type === 'action') {
      return 'Tap to open';
    }
    return undefined;
  };

  return (
    <>
      <TouchableOpacity
        testID={item.testID || `profile-${item.key}-button`}
        activeOpacity={0.7}
        onPress={handlePress}
        style={[
          styles.rowWrapper,
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
        ]}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={getAccessibilityHint()}
        accessibilityState={{ disabled: item.disabled }}
      >
        <View style={styles.row}>
          {item.icon}
          <Text style={styles.rowLabel}>{item.label}</Text>
          <View style={styles.rowSpacer} />

          {item.type === 'text' && (
            <>
              <ValueText>{item.value as string}</ValueText>
              <Icon
                library="Feather"
                name="edit-2"
                size={16}
                color={theme.colors.textSecondary}
              />
            </>
          )}

          {item.type === 'switch' && (
            <Switch
              testID={`profile-${item.key}-switch`}
              value={item.value as boolean}
              onValueChange={handleSwitchChange}
            />
          )}

          {item.type === 'radio' && item.options && (
            <Ionicons
              name={
                item.selected === item.value
                  ? 'radio-button-on'
                  : 'radio-button-off'
              }
              size={20}
              color={
                item.selected === item.value
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
          )}

          {item.type === 'modal' && (
            <View style={styles.modalValueContainer}>
              <Text
                style={styles.modalValueText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.options?.find((opt: any) => opt.value === item.value)
                  ?.label || 'Select'}
              </Text>
              <Icon
                library="Feather"
                name="chevron-right"
                size={20}
                color={theme.colors.textSecondary}
              />
            </View>
          )}

          {item.type === 'action' && (
            <Icon
              library="Feather"
              name="chevron-right"
              size={20}
              color={theme.colors.textSecondary}
            />
          )}

          {item.type === 'navigation' && (
            <Icon
              library="Feather"
              name="chevron-right"
              size={20}
              color={theme.colors.textSecondary}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Text Edit Modal */}
      <Modal
        visible={textEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleTextCancel}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Discard changes and close"
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{inputLabel}</Text>
            <TouchableOpacity
              onPress={form.handleSubmit(handleTextSave)}
              style={styles.modalSaveButton}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityHint={`Save changes to ${inputLabel}`}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.textInputContainer}>
            <Controller
              control={form.control}
              name={item.key}
              render={({ field, fieldState }) => (
                <InputComponent
                  label={inputLabel}
                  placeholder={placeholder}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  errorMessage={fieldState.error?.message}
                  autoFocus
                />
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Selection Modal */}
      {item.type === 'modal' && item.options && (
        <Modal visible={modalVisible} animationType="slide">
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
                accessibilityHint="Close selection modal"
              >
                <Icon
                  library="Feather"
                  name="x"
                  size={24}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{item.label}</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <ScrollView>
              {item.options.map((opt: any) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.modalOption}
                  onPress={handleModalOptionPress(opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityHint={`Select ${opt.label}`}
                  accessibilityState={{ selected: item.value === opt.value }}
                >
                  <Text style={styles.modalOptionText}>{opt.label}</Text>
                  {item.value === opt.value && (
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
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceVariant,
  },
  rowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLast: {
    borderBottomLeftRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.lg,
    borderBottomWidth: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { marginLeft: 8, fontSize: 16, color: theme.colors.textPrimary },
  rowSpacer: { flex: 1 },
  modalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  modalValueText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
    minWidth: 60,
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  modalSaveButton: {
    padding: 4,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  modalSaveText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalHeaderSpacer: {
    width: 32,
  },
  textInputContainer: {
    padding: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  modalOptionText: {
    fontSize: 16,
    flex: 1,
    color: theme.colors.textPrimary,
  },
}));

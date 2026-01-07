import React, { useState, useCallback } from 'react';
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
import { ValueText } from '../atoms/ValueText';
import {
  getInputLabelForField,
  getPlaceholderForField,
} from '#utils/inputMapping';
import { getValidationSchemaForField } from '#/utils/validation/profile';
import { Icon } from '#/utils';
import { TextEditBottomSheet } from '#/components/modals/TextEditBottomSheet';

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
  const [textEditVisible, setTextEditVisible] = useState(false);

  // Get field metadata
  const inputLabel = getInputLabelForField(item.key);
  const placeholder = getPlaceholderForField(item.key);

  const handlePress = useCallback(() => {
    if (item.type === 'modal') {
      setModalVisible(true);
    } else if (item.type === 'text') {
      setTextEditVisible(true);
    } else if (item.onPress) {
      item.onPress();
    }
  }, [item]);

  const handleSwitchChange = useCallback(() => {
    if (item.type !== 'switch') return;
    if (item.onPress) {
      item.onPress();
    }
  }, [item]);

  const handleModalOptionPress = useCallback(
    (optionValue: string) => () => {
      if (item.onSave) {
        item.onSave(optionValue);
      }
      setModalVisible(false);
    },
    [item],
  );

  const handleTextSave = useCallback(
    (value: string) => {
      if (item.onSave) {
        item.onSave(value);
      }
    },
    [item],
  );

  const handleTextEditClose = useCallback(() => {
    setTextEditVisible(false);
  }, []);

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
    } else if (item.type === 'info') {
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
        activeOpacity={item.type === 'info' ? 1 : 0.7}
        onPress={item.type === 'info' ? undefined : handlePress}
        disabled={item.type === 'info'}
        style={[
          styles.rowWrapper,
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
        ]}
        accessibilityRole={item.type === 'info' ? 'text' : 'button'}
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={getAccessibilityHint()}
        accessibilityState={{ disabled: item.disabled || item.type === 'info' }}
      >
        <View style={styles.row}>
          {item.icon}
          <Text style={styles.rowLabel}>{item.label}</Text>
          <View style={styles.rowSpacer} />

          {item.type === 'info' && (
            <ValueText>{item.value as string}</ValueText>
          )}

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

      {/* Text Edit Bottom Sheet */}
      <TextEditBottomSheet
        visible={textEditVisible}
        title={inputLabel}
        label={inputLabel}
        placeholder={placeholder}
        initialValue={(item.value as string) || ''}
        fieldKey={item.key}
        // @ts-expect-error - yup schema type compatibility
        validationSchema={getValidationSchemaForField(item.key)}
        onSave={handleTextSave}
        onClose={handleTextEditClose}
        multiline={item.key === 'bio'}
        keyboardType={item.key === 'phone' ? 'phone-pad' : 'default'}
      />

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
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceVariant,
  },
  rowFirst: {
    borderTopLeftRadius: theme.radii.md,
    borderTopRightRadius: theme.radii.md,
  },
  rowLast: {
    borderBottomLeftRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.lg,
    borderBottomWidth: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
  },
  rowSpacer: { flex: 1 },
  modalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  modalValueText: {
    fontSize: theme.typography.fontSize.md,
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
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
    minWidth: 60,
  },
  modalHeaderSpacer: {
    width: theme.sizes.button.sm,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  modalOptionText: {
    fontSize: theme.typography.fontSize.md,
    flex: 1,
    color: theme.colors.textPrimary,
  },
}));

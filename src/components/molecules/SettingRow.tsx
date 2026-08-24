import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { ValueText } from '../atoms/ValueText';
import {
  getInputLabelForField,
  getPlaceholderForField,
} from '#utils/inputMapping';
import { getValidationSchemaForField } from '#/utils/validation/profile';
import { Icon } from '#/utils/iconUtils';
import { TextEditBottomSheet } from '#/components/modals/TextEditBottomSheet/TextEditBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { AppPressable } from '#components/atoms/AppPressable';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';

/** A single option for a `modal`/`radio` setting row. */
export interface SettingOption {
  label: string;
  value: string;
}

/** Runtime descriptor consumed by SettingRow / SettingsSection. */
export interface SettingItem {
  key: string;
  label: string;
  type: string;
  testID?: string;
  subtitle?: string;
  disabled?: boolean;
  value?: string | boolean;
  selected?: string;
  options?: SettingOption[];
  icon?: React.ReactNode;
  onSave?: (value: string) => void;
  onPress?: () => void;
}

export interface SettingRowProps {
  item: SettingItem;
  isFirst: boolean;
  isLast: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  item,
  isFirst,
  isLast,
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [textEditVisible, setTextEditVisible] = useState(false);

  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: modalVisible,
    onDismiss: () => setModalVisible(false),
    snapPoints: [],
    enableDynamicSizing: true,
  });

  // Get field metadata
  const inputLabel = getInputLabelForField(item.key);
  const placeholder = getPlaceholderForField(item.key);

  const handlePress = () => {
    if (item.type === 'modal') {
      setModalVisible(true);
    } else if (item.type === 'text') {
      setTextEditVisible(true);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  const handleSwitchChange = () => {
    if (item.type !== 'switch') return;
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

  const handleTextSave = (value: string) => {
    if (item.onSave) {
      item.onSave(value);
    }
  };

  const handleTextEditClose = () => {
    setTextEditVisible(false);
  };

  // Build accessibility label based on setting type
  const getAccessibilityLabel = () => {
    const baseLabel = item.label;
    if (item.type === 'switch') {
      return `${baseLabel}, ${
        item.value ? t('settingRow.enabled') : t('settingRow.disabled')
      }`;
    } else if (item.type === 'modal' && item.options) {
      const selectedOption =
        item.options?.find(opt => opt.value === item.value)?.label ||
        t('labels.select');
      return t('settingRow.currentlySelected', {
        label: baseLabel,
        selected: selectedOption,
      });
    } else if (item.type === 'text') {
      return `${baseLabel}, ${item.value || t('settingRow.notSet')}`;
    } else if (item.type === 'info') {
      return `${baseLabel}, ${item.value || t('settingRow.notSet')}`;
    }
    return baseLabel;
  };

  const getAccessibilityHint = () => {
    if (item.type === 'switch') {
      return item.value
        ? t('settingRow.tapToDisable', { label: item.label })
        : t('settingRow.tapToEnable', { label: item.label });
    } else if (item.type === 'modal') {
      return t('settingRow.tapToSelect');
    } else if (item.type === 'text') {
      return t('labels.tapToEdit');
    } else if (item.type === 'navigation' || item.type === 'action') {
      return t('settingRow.tapToOpen');
    }
    return undefined;
  };

  return (
    <>
      <AppPressable
        testID={item.testID || `profile-${item.key}-button`}
        onPress={item.type === 'info' ? undefined : handlePress}
        // Selection tick on rows that do something on press. Info rows aren't
        // pressable; switch rows toggle via the switch widget (a row-level
        // haptic there would double-fire with the switch's own feedback).
        haptic={
          item.type !== 'info' && item.type !== 'switch' && !item.disabled
        }
        disabled={item.type === 'info'}
        android_ripple={item.type === 'info' ? null : RIPPLE.SUBTLE}
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
          <View style={styles.rowLabelColumn}>
            <Text size="md">{item.label}</Text>
            {!!item.subtitle && (
              <Text
                size="sm"
                tone="secondary"
                lineHeight="tight"
                style={styles.rowSubtitle}
              >
                {item.subtitle}
              </Text>
            )}
          </View>
          <View style={styles.rowSpacer} />

          {item.type === 'info' && (
            <ValueText>{item.value as string}</ValueText>
          )}

          {item.type === 'text' && (
            <>
              <ValueText>{item.value as string}</ValueText>
              <Icon name="pencil" size={16} tone="textSecondary" />
            </>
          )}

          {item.type === 'switch' && (
            <BaseSwitch
              testID={`profile-${item.key}-switch`}
              value={item.value as boolean}
              onValueChange={handleSwitchChange}
            />
          )}

          {item.type === 'radio' && !!item.options && (
            <Icon
              name={
                item.selected === item.value
                  ? 'radio-button-on'
                  : 'radio-button-off'
              }
              size={20}
              tone={item.selected === item.value ? 'primary' : 'textSecondary'}
            />
          )}

          {item.type === 'modal' && (
            <View style={styles.modalValueContainer}>
              <Text
                size="md"
                tone="secondary"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.options?.find(opt => opt.value === item.value)?.label ||
                  t('labels.select')}
              </Text>
              <Icon name="chevron-forward" size={20} tone="textSecondary" />
            </View>
          )}

          {item.type === 'action' && (
            <Icon name="chevron-forward" size={20} tone="textSecondary" />
          )}

          {item.type === 'navigation' && (
            <Icon name="chevron-forward" size={20} tone="textSecondary" />
          )}
        </View>
      </AppPressable>
      {/* Text Edit Bottom Sheet */}
      <TextEditBottomSheet
        visible={textEditVisible}
        title={inputLabel}
        label={inputLabel}
        placeholder={placeholder}
        initialValue={typeof item.value === 'string' ? item.value : ''}
        fieldKey={item.key}
        // @ts-expect-error - yup schema type compatibility
        validationSchema={getValidationSchemaForField(item.key)}
        onSave={handleTextSave}
        onClose={handleTextEditClose}
        multiline={item.key === 'bio'}
        keyboardType={item.key === 'phone' ? 'phone-pad' : 'default'}
      />
      {/* Selection Bottom Sheet */}
      {item.type === 'modal' && !!item.options && (
        <BottomSheetModal ref={ref} {...modalProps}>
          <BottomSheetView style={[styles.sheetContent, contentContainerStyle]}>
            <Text
              size="lg"
              weight="semibold"
              align="center"
              style={styles.sheetTitle}
            >
              {item.label}
            </Text>
            <View style={styles.sheetDivider} />
            {item.options.map(opt => (
              <AppPressable
                key={opt.value}
                style={styles.sheetOption}
                onPress={handleModalOptionPress(opt.value)}
                android_ripple={RIPPLE.SUBTLE}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityHint={t('settingRow.selectOption', {
                  label: opt.label,
                })}
                accessibilityState={{ selected: item.value === opt.value }}
              >
                <Text size="md" style={styles.sheetOptionText}>
                  {opt.label}
                </Text>
                {item.value === opt.value && (
                  <Icon name="checkmark" size={20} tone="primary" />
                )}
              </AppPressable>
            ))}
          </BottomSheetView>
        </BottomSheetModal>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
  },
  rowFirst: {
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
  },
  rowLast: {
    borderBottomLeftRadius: theme.radii.lg,
    borderBottomRightRadius: theme.radii.lg,
    borderBottomWidth: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabelColumn: {
    marginLeft: theme.spacing.sm,
    flexShrink: 1,
  },
  rowSubtitle: {
    marginTop: theme.spacing.xs,
  },
  rowSpacer: { flex: 1 },
  modalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  sheetTitle: {
    paddingVertical: theme.spacing.sm,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginBottom: theme.spacing.sm,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  sheetOptionText: {
    flex: 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { StyleSheet } from 'react-native-unistyles';
import { ValueText } from '../atoms/ValueText';
import { Icon } from '#components/atoms/Icon';
import type { AnyObjectSchema } from 'yup';
import {
  TextEditBottomSheet,
  type TextEditKeyboardType,
} from '#components/organisms/TextEditBottomSheet/TextEditBottomSheet';
import { AppPressable } from '#components/atoms/AppPressable';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';
import { Divider } from '#components/atoms/Divider';
import { Sheet } from '#components/templates/Sheet';
import { kitTestIDs } from '#components/testIDs';
import { firstNonBlank } from '#utils/firstNonBlank';

/** A single option for a `modal` setting row. */
export interface SettingOption {
  label: string;
  value: string;
}

interface SettingItemBase {
  key: string;
  label: string;
  testID?: string;
  subtitle?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

/** A value shown, not edited. */
interface InfoSetting extends SettingItemBase {
  type: 'info';
  value?: string;
}

/** A value edited in a one-field sheet, checked by the row's own schema. */
interface TextSetting extends SettingItemBase {
  type: 'text';
  value?: string;
  placeholder?: string;
  /** Keyed by the row's `key`; plain text when left out. */
  validationSchema?: AnyObjectSchema;
  multiline?: boolean;
  keyboardType?: TextEditKeyboardType;
  onSave?: (value: string) => void;
}

interface SwitchSetting extends SettingItemBase {
  type: 'switch';
  value?: boolean;
  /** A write is in flight, so the control shows a spinner. */
  loading?: boolean;
  onPress?: () => void;
}

/** A choice among options, picked in a sheet. */
interface ModalSetting extends SettingItemBase {
  type: 'modal';
  value?: string;
  /** A compact form for the row, when the option label is long. */
  valueLabel?: string;
  options?: SettingOption[];
  /** Shown under the options when the read behind them failed. */
  unavailable?: React.ReactNode;
  onSave?: (value: string) => void;
}

/** `navigation` opens a screen, behind a chevron; `action` acts in place. */
interface PressSetting extends SettingItemBase {
  type: 'navigation' | 'action';
  onPress?: () => void;
}

/** Runtime descriptor consumed by SettingRow / SettingsSection. */
export type SettingItem =
  | InfoSetting
  | TextSetting
  | SwitchSetting
  | ModalSetting
  | PressSetting;

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

  const handlePress = () => {
    if (item.type === 'modal') {
      setModalVisible(true);
    } else if (item.type === 'text') {
      setTextEditVisible(true);
    } else if (item.type !== 'info') {
      item.onPress?.();
    }
  };

  const handleSwitchChange = () => {
    if (item.type === 'switch') item.onPress?.();
  };

  const handleModalOptionPress = (optionValue: string) => () => {
    if (item.type === 'modal') item.onSave?.(optionValue);
    setModalVisible(false);
  };

  const handleTextSave = (value: string) => {
    if (item.type === 'text') item.onSave?.(value);
  };

  const handleTextEditClose = () => {
    setTextEditVisible(false);
  };

  const textValue =
    item.type === 'text' || item.type === 'info' ? item.value : undefined;

  // The row's label replaces the text inside it, so the subtitle joins the
  // label: a screen reader user can turn hints off.
  const getAccessibilityLabel = () => {
    const baseLabel = item.subtitle
      ? `${item.label}, ${item.subtitle}`
      : item.label;
    if (item.type === 'switch') {
      return `${baseLabel}, ${
        item.value ? t('settingRow.enabled') : t('settingRow.disabled')
      }`;
    } else if (item.type === 'modal' && item.options) {
      const selectedOption =
        item.options.find(opt => opt.value === item.value)?.label ??
        t('labels.select');
      return t('settingRow.currentlySelected', {
        label: baseLabel,
        selected: selectedOption,
      });
    } else if (item.type === 'text' || item.type === 'info') {
      return `${baseLabel}, ${
        firstNonBlank(textValue) ?? t('settingRow.notSet')
      }`;
    }
    return baseLabel;
  };

  const getActionHint = () => {
    if (item.type === 'switch') {
      return item.value
        ? t('settingRow.tapToDisable', { label: item.label })
        : t('settingRow.tapToEnable', { label: item.label });
    } else if (item.type === 'modal') {
      return t('settingRow.tapToSelect');
    } else if (item.type === 'text') {
      return t('labels.tapToEdit');
    } else if (item.type === 'navigation') {
      return t('settingRow.tapToOpen');
    }
    return undefined;
  };

  // A row that reports itself disabled is inert everywhere, not only in the
  // switch it greys: the label area is the rest of the same control.
  const isInert = item.type === 'info' || !!item.disabled;

  return (
    <>
      <AppPressable
        testID={item.testID ?? kitTestIDs.settingButton(item.key)}
        onPress={isInert ? undefined : handlePress}
        // Selection tick on rows that do something on press. Info rows aren't
        // pressable; switch rows toggle via the switch widget (a row-level
        // haptic there would double-fire with the switch's own feedback).
        haptic={
          item.type !== 'info' && item.type !== 'switch' && !item.disabled
        }
        disabled={isInert}
        android_ripple={isInert ? undefined : RIPPLE.SUBTLE}
        style={[
          styles.rowWrapper,
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
        ]}
        accessibilityRole={item.type === 'info' ? 'text' : 'button'}
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={getActionHint()}
        accessibilityState={{
          disabled: !!item.disabled || item.type === 'info',
        }}
      >
        <View style={styles.row}>
          {item.icon}
          <View style={styles.rowLabelColumn}>
            <Text>{item.label}</Text>
            {!!item.subtitle && (
              <Text
                role="caption"
                tone="secondary"
                lineHeight="tight"
                style={styles.rowSubtitle}
              >
                {item.subtitle}
              </Text>
            )}
          </View>
          <View style={styles.rowSpacer} />

          {item.type === 'info' && <ValueText>{textValue}</ValueText>}

          {item.type === 'text' && (
            <>
              <ValueText>{textValue}</ValueText>
              <Icon name="pencil" size="xs" tone="textSecondary" />
            </>
          )}

          {item.type === 'switch' && (
            <BaseSwitch
              testID={item.testID ?? kitTestIDs.settingSwitch(item.key)}
              accessibilityLabel={item.label}
              value={item.value === true}
              onValueChange={handleSwitchChange}
              disabled={item.disabled}
              loading={item.loading}
            />
          )}

          {item.type === 'modal' && (
            <View style={styles.modalValueContainer}>
              <Text tone="secondary" numberOfLines={1} ellipsizeMode="tail">
                {item.valueLabel ??
                  item.options?.find(opt => opt.value === item.value)?.label ??
                  t('labels.select')}
              </Text>
              <Icon name="chevron-forward" size="sm" tone="textSecondary" />
            </View>
          )}

          {item.type === 'navigation' && (
            <Icon name="chevron-forward" size="sm" tone="textSecondary" />
          )}
        </View>
      </AppPressable>
      {item.type === 'text' ? (
        <TextEditBottomSheet
          visible={textEditVisible}
          title={item.label}
          label={item.label}
          placeholder={item.placeholder}
          initialValue={item.value ?? ''}
          fieldKey={item.key}
          validationSchema={item.validationSchema}
          onSave={handleTextSave}
          onClose={handleTextEditClose}
          multiline={item.multiline}
          keyboardType={item.keyboardType}
        />
      ) : null}
      {/* Selection Bottom Sheet */}
      {item.type === 'modal' && !!item.options && (
        <Sheet
          mode="view"
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          snapPoints={[]}
          enableDynamicSizing={true}
        >
          <Text role="heading" align="center" style={styles.sheetTitle}>
            {item.label}
          </Text>
          <Divider style={styles.sheetDivider} />
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
              <Text style={styles.sheetOptionText}>{opt.label}</Text>
              {item.value === opt.value && (
                <Icon name="checkmark" size="sm" tone="primary" />
              )}
            </AppPressable>
          ))}
          {item.unavailable}
        </Sheet>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
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
    borderBottomWidth: theme.borderWidth.none,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabelColumn: {
    marginLeft: theme.spacing.sm,
    // Takes the row's free space rather than only yielding it: with
    // `flexShrink` alone a long value keeps its full width and the label
    // column collapses, wrapping a subtitle into a narrow column beside it.
    flex: 1,
  },
  rowSubtitle: {
    marginTop: theme.spacing.xs,
  },
  rowSpacer: { width: theme.spacing.sm },
  modalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
    // The value truncates (it already asks for one line); without this it
    // holds its natural width and the label column pays for it instead.
    flexShrink: 1,
  },
  sheetTitle: {
    paddingVertical: theme.spacing.sm,
  },
  sheetDivider: {
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
}));

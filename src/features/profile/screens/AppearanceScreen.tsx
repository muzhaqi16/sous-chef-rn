import React from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { usePreferences, useThemePreferences } from '#store/useAppStore';
import {
  ThemePreference,
  DensityPreference,
  FontScalePreference,
} from '#store/slices/preferenceTypes';
import { DENSITY_META, FONT_SCALE_META } from '#/theme/appearanceConfig';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';
import { SubScreen } from '#components/templates/SubScreen';
import { colors } from '#/theme/foundations/colors';

const APP_COLORS: {
  labelKey: TranslationKey;
  value: string | null;
}[] = [
  { labelKey: 'appearance.colorDefault', value: null },
  {
    labelKey: 'storageLocationForm.colorBlue',
    value: colors.accentSwatches.blue,
  },
  {
    labelKey: 'storageLocationForm.colorGreen',
    value: colors.accentSwatches.green,
  },
  {
    labelKey: 'storageLocationForm.colorPurple',
    value: colors.accentSwatches.purple,
  },
  {
    labelKey: 'storageLocationForm.colorRed',
    value: colors.accentSwatches.red,
  },
  {
    labelKey: 'storageLocationForm.colorTeal',
    value: colors.accentSwatches.teal,
  },
  {
    labelKey: 'storageLocationForm.colorPink',
    value: colors.accentSwatches.pink,
  },
];

// Option value lists derived from the enums so the pickers stay in sync —
// add/remove a member and the segmented control follows automatically (enum
// order). Labels are resolved at render via the META tables in `formatLabel`.
const DENSITY_OPTIONS = Object.values(DensityPreference);
const FONT_SCALE_OPTIONS = Object.values(FontScalePreference);

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { theme, setTheme } = usePreferences();

  const {
    primaryColorOverride,
    densityPreference,
    fontScalePreference,
    highContrast,
    setPrimaryColorOverride,
    setDensityPreference,
    setFontScalePreference,
    setHighContrast,
  } = useThemePreferences();

  return (
    <SubScreen title={t('labels.appearance')}>
      <View style={styles.content}>
        {/* Theme */}
        <Text role="bodyStrong">{t('appearance.themeSection')}</Text>
        <SegmentedControl
          options={[
            ThemePreference.LIGHT,
            ThemePreference.DARK,
            ThemePreference.SYSTEM,
          ]}
          value={theme}
          formatLabel={v =>
            v === ThemePreference.LIGHT
              ? t('appearance.themeLight')
              : v === ThemePreference.DARK
              ? t('appearance.themeDark')
              : t('labels.system')
          }
          onChange={setTheme}
        />

        {/* App Color */}
        <Text role="bodyStrong">{t('appearance.brandColor')}</Text>
        <View style={styles.colorRow}>
          {APP_COLORS.map(c => (
            <AppPressable
              key={c.labelKey}
              haptic
              onPress={() => setPrimaryColorOverride(c.value)}
              accessibilityLabel={t(c.labelKey)}
              style={[
                styles.colorSwatch,
                { backgroundColor: c.value ?? appConfig.branding.primaryColor },
                (primaryColorOverride ?? null) === c.value &&
                  styles.colorSwatchSelected,
              ]}
            />
          ))}
        </View>

        {/* Density */}
        <Text role="bodyStrong">{t('appearance.density')}</Text>
        <SegmentedControl
          options={DENSITY_OPTIONS}
          value={densityPreference}
          formatLabel={v => t(DENSITY_META[v].labelKey)}
          onChange={setDensityPreference}
        />

        {/* Font Scale */}
        <Text role="bodyStrong">{t('appearance.fontScale')}</Text>
        <SegmentedControl
          options={FONT_SCALE_OPTIONS}
          value={fontScalePreference}
          formatLabel={v => t(FONT_SCALE_META[v].labelKey)}
          onChange={setFontScalePreference}
        />

        {/* High Contrast */}
        <View style={styles.switchRow}>
          <View>
            <Text role="bodyStrong">{t('appearance.highContrast')}</Text>
            <Text
              role="caption"
              tone="secondary"
              style={styles.switchDescription}
            >
              {t('appearance.highContrastDesc')}
            </Text>
          </View>
          <BaseSwitch
            accessibilityLabel={t('appearance.highContrast')}
            value={highContrast}
            onValueChange={setHighContrast}
          />
        </View>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create(theme => ({
  content: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
  },
  colorSwatchSelected: {
    borderWidth: theme.borderWidth.thick,
    borderColor: theme.colors.textPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  switchDescription: {
    marginTop: theme.spacing.xs,
    maxWidth: '80%',
  },
}));

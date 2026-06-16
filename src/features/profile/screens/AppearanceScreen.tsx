import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppPressable } from '#components/atoms/AppPressable';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { Header } from '#components/molecules/Header';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useTheme as useThemePreference,
  useThemePreferences,
} from '#store/useAppStore';
import { useTheme } from '#hooks/useTheme';
import {
  ThemePreference,
  DensityPreference,
  FontScalePreference,
} from '#store/slices/preferenceTypes';
import { DENSITY_META, FONT_SCALE_META } from '#/theme/appearanceConfig';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';

const APP_COLORS: {
  labelKey: string;
  value: string | null;
  hex: string;
}[] = [
  {
    labelKey: 'appearance.colorDefault',
    value: null,
    hex: appConfig.branding.primaryColor,
  },
  { labelKey: 'appearance.colorBlue', value: '#2563EB', hex: '#2563EB' },
  { labelKey: 'appearance.colorGreen', value: '#16A34A', hex: '#16A34A' },
  { labelKey: 'appearance.colorPurple', value: '#7C3AED', hex: '#7C3AED' },
  { labelKey: 'appearance.colorRed', value: '#DC2626', hex: '#DC2626' },
  { labelKey: 'appearance.colorTeal', value: '#0D9488', hex: '#0D9488' },
  {
    labelKey: 'storageLocationForm.colorPink',
    value: '#f51aff',
    hex: '#f51aff',
  },
];

// Option value lists derived from the enums so the pickers stay in sync —
// add/remove a member and the segmented control follows automatically (enum
// order). Labels are resolved at render via the META tables in `formatLabel`.
const DENSITY_OPTIONS = Object.values(DensityPreference);
const FONT_SCALE_OPTIONS = Object.values(FontScalePreference);

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();
  const { setLightTheme, setDarkTheme, setSystemTheme } = useTheme();

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

  const userThemePreference = useThemePreference();

  return (
    <View style={styles.container}>
      <Header
        title={t('appearance.title')}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Theme */}
        <Text size="md" weight="semibold">
          {t('appearance.themeSection')}
        </Text>
        <SegmentedControl
          options={[
            ThemePreference.LIGHT,
            ThemePreference.DARK,
            ThemePreference.SYSTEM,
          ]}
          value={userThemePreference}
          formatLabel={v =>
            v === ThemePreference.LIGHT
              ? t('appearance.themeLight')
              : v === ThemePreference.DARK
              ? t('appearance.themeDark')
              : t('appearance.themeSystem')
          }
          onChange={v => {
            if (v === ThemePreference.LIGHT) setLightTheme();
            else if (v === ThemePreference.DARK) setDarkTheme();
            else setSystemTheme();
          }}
        />

        {/* App Color */}
        <Text size="md" weight="semibold">
          {t('appearance.brandColor')}
        </Text>
        <View style={styles.colorRow}>
          {APP_COLORS.map(c => (
            <AppPressable
              key={c.labelKey}
              haptic
              onPress={() => setPrimaryColorOverride(c.value)}
              accessibilityLabel={t(c.labelKey)}
              style={[
                styles.colorSwatch,
                { backgroundColor: c.hex },
                (primaryColorOverride ?? null) === c.value &&
                  styles.colorSwatchSelected,
              ]}
            />
          ))}
        </View>

        {/* Density */}
        <Text size="md" weight="semibold">
          {t('appearance.density')}
        </Text>
        <SegmentedControl
          options={DENSITY_OPTIONS}
          value={densityPreference}
          formatLabel={v => t(DENSITY_META[v].labelKey)}
          onChange={setDensityPreference}
        />

        {/* Font Scale */}
        <Text size="md" weight="semibold">
          {t('appearance.fontScale')}
        </Text>
        <SegmentedControl
          options={FONT_SCALE_OPTIONS}
          value={fontScalePreference}
          formatLabel={v => t(FONT_SCALE_META[v].labelKey)}
          onChange={setFontScalePreference}
        />

        {/* High Contrast */}
        <View style={styles.switchRow}>
          <View>
            <Text size="md" weight="medium">
              {t('appearance.highContrast')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.switchDescription}>
              {t('appearance.highContrastDesc')}
            </Text>
          </View>
          <BaseSwitch value={highContrast} onValueChange={setHighContrast} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
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
    borderWidth: 3,
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

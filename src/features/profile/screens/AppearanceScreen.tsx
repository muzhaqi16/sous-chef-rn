import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
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
import { Text } from '#components/atoms/Text';

const APP_COLORS: {
  labelKey: string;
  value: string | null;
  hex: string;
}[] = [
  { labelKey: 'appearance.colorDefault', value: null, hex: '#f97416' },
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

// Derived from the metadata tables so the picker stays in sync with the enum —
// add/remove a member and the option list follows automatically (enum order).
const DENSITY_OPTIONS_KEYS = Object.values(DensityPreference).map(value => ({
  value,
  labelKey: DENSITY_META[value].labelKey,
}));

const FONT_SCALE_OPTION_KEYS = Object.values(FontScalePreference).map(
  value => ({
    value,
    labelKey: FONT_SCALE_META[value].labelKey,
  }),
);

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={segStyles.row}>
      {options.map(opt => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[
            segStyles.segment,
            opt.value === value && segStyles.segmentActive,
          ]}
        >
          <Text
            size="sm"
            align="center"
            tone={opt.value === value ? undefined : 'secondary'}
            weight={opt.value === value ? 'semibold' : undefined}
            style={segStyles.segmentLabel}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

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
            { label: t('appearance.themeLight'), value: ThemePreference.LIGHT },
            { label: t('appearance.themeDark'), value: ThemePreference.DARK },
            {
              label: t('appearance.themeSystem'),
              value: ThemePreference.SYSTEM,
            },
          ]}
          value={userThemePreference}
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
            <Pressable
              key={c.labelKey}
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
          options={DENSITY_OPTIONS_KEYS.map(o => ({
            label: t(o.labelKey),
            value: o.value,
          }))}
          value={densityPreference}
          onChange={setDensityPreference}
        />

        {/* Font Scale */}
        <Text size="md" weight="semibold">
          {t('appearance.fontScale')}
        </Text>
        <SegmentedControl
          options={FONT_SCALE_OPTION_KEYS.map(o => ({
            label: t(o.labelKey),
            value: o.value,
          }))}
          value={fontScalePreference}
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

const segStyles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceVariant,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md - 2,
  },
  segmentActive: {
    backgroundColor: theme.colors.surface,
  },
  // Center wrapped labels horizontally so multi-line options (e.g. "Shumë të
  // mëdha") balance visually with single-line siblings.
  segmentLabel: {
    textAlign: 'center',
  },
}));

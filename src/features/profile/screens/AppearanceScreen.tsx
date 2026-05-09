import React from 'react';
import { View, ScrollView, Switch } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Header } from '#components/molecules/Header';
import { useSafeNavigation } from '#hooks/navigation/useSafeNavigation';
import { useAppStore } from '#store/useAppStore';
import { useTheme } from '#hooks/useTheme';
import { ThemePreference } from '#store/slices/preferencesSlice';
import type {
  DensityPreference,
  FontScalePreference,
} from '#store/slices/preferencesSlice';
import { Text } from '#components/atoms/Text';

const BRAND_COLORS = [
  { label: 'Default', value: null, hex: '#f76818' },
  { label: 'Blue', value: '#2563EB', hex: '#2563EB' },
  { label: 'Green', value: '#16A34A', hex: '#16A34A' },
  { label: 'Purple', value: '#7C3AED', hex: '#7C3AED' },
  { label: 'Red', value: '#DC2626', hex: '#DC2626' },
  { label: 'Teal', value: '#0D9488', hex: '#0D9488' },
];

const DENSITY_OPTIONS: { label: string; value: DensityPreference }[] = [
  { label: 'Compact', value: 'compact' },
  { label: 'Comfortable', value: 'comfortable' },
  { label: 'Spacious', value: 'spacious' },
];

const FONT_SCALE_OPTIONS: { label: string; value: FontScalePreference }[] = [
  { label: 'Small', value: 'sm' },
  { label: 'Default', value: 'system' },
  { label: 'Large', value: 'lg' },
  { label: 'Extra Large', value: 'xl' },
];

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
            tone={opt.value === value ? undefined : 'secondary'}
            weight={opt.value === value ? 'semibold' : undefined}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function AppearanceScreen() {
  const { navigation } = useSafeNavigation();
  const { setLightTheme, setDarkTheme, setSystemTheme } = useTheme();

  const primaryColorOverride = useAppStore(s => s.primaryColorOverride);
  const densityPreference = useAppStore(s => s.densityPreference);
  const fontScalePreference = useAppStore(s => s.fontScalePreference);
  const highContrast = useAppStore(s => s.highContrast);

  const setPrimaryColorOverride = useAppStore(s => s.setPrimaryColorOverride);
  const setDensityPreference = useAppStore(s => s.setDensityPreference);
  const setFontScalePreference = useAppStore(s => s.setFontScalePreference);
  const setHighContrast = useAppStore(s => s.setHighContrast);

  const userThemePreference = useAppStore(s => s.theme);

  return (
    <View style={styles.container}>
      <Header title="Appearance" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Theme */}
        <Text size="md" weight="semibold">
          Theme
        </Text>
        <SegmentedControl
          options={[
            { label: 'Light', value: ThemePreference.LIGHT },
            { label: 'Dark', value: ThemePreference.DARK },
            { label: 'System', value: ThemePreference.SYSTEM },
          ]}
          value={userThemePreference}
          onChange={v => {
            if (v === ThemePreference.LIGHT) setLightTheme();
            else if (v === ThemePreference.DARK) setDarkTheme();
            else setSystemTheme();
          }}
        />

        {/* Brand Color */}
        <Text size="md" weight="semibold">
          Brand Color
        </Text>
        <View style={styles.colorRow}>
          {BRAND_COLORS.map(c => (
            <Pressable
              key={c.label}
              onPress={() => setPrimaryColorOverride(c.value)}
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
          Density
        </Text>
        <SegmentedControl
          options={DENSITY_OPTIONS}
          value={densityPreference}
          onChange={setDensityPreference}
        />

        {/* Font Scale */}
        <Text size="md" weight="semibold">
          Font Scale
        </Text>
        <SegmentedControl
          options={FONT_SCALE_OPTIONS}
          value={fontScalePreference}
          onChange={setFontScalePreference}
        />

        {/* High Contrast */}
        <View style={styles.switchRow}>
          <View>
            <Text size="md" weight="medium">
              High Contrast
            </Text>
            <Text size="sm" tone="secondary" style={styles.switchDescription}>
              Increases text and border contrast for accessibility
            </Text>
          </View>
          <Switch value={highContrast} onValueChange={setHighContrast} />
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
    gap: theme.spacing.sm,
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
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceVariant,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radii.md - 2,
  },
  segmentActive: {
    backgroundColor: theme.colors.surface,
  },
}));

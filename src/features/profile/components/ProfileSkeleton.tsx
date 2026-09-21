import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Screen } from '#components/templates/Screen';
import { SkeletonCircle } from '#components/atoms/Skeleton/SkeletonCircle';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';

const AVATAR_SIZE = 80; // matches ProfileHero.AVATAR_SIZE

// Mirrors `PROFILE_SETTINGS_CONFIG` in `src/config/settingsConfig.ts`, minus the
// Developer section that `Environment.shouldEnableDebugFeatures()` gates out.
const SECTIONS: ReadonlyArray<{ rows: number; hasTitle: boolean }> = [
  { rows: 1, hasTitle: true }, // Personal Information
  { rows: 2, hasTitle: true }, // Appearance & Language
  { rows: 1, hasTitle: true }, // Notifications
  { rows: 1, hasTitle: true }, // Dietary Profile
  { rows: 1, hasTitle: true }, // App Settings
  { rows: 2, hasTitle: true }, // Security
  { rows: 1, hasTitle: false }, // Logout
];

// The real header, so back works before the profile lands; the hero and rows
// mirror `ProfileHero` and `SettingRow.rowWrapper` so nothing shifts when it does.
export const ProfileSkeleton: React.FC<{ onBack: () => void }> = ({
  onBack,
}) => {
  const { t } = useTranslation();
  return (
    <Screen
      scroll="none"
      header={{
        back: onBack,
        actions: [
          {
            icon: 'ellipsis-vertical',
            onPress: onBack,
            disabled: true,
            accessibilityLabel: t('labels.moreOptions'),
          },
        ],
      }}
    >
      <View style={styles.hero}>
        <SkeletonCircle size={AVATAR_SIZE} />
        <SkeletonLine width="40%" height={16} />
        <SkeletonLine width="55%" height={12} />
      </View>

      {SECTIONS.map((section, idx) => (
        <View key={idx} style={styles.section}>
          {section.hasTitle ? (
            <SkeletonLine width="30%" height={12} style={styles.sectionTitle} />
          ) : (
            <View style={styles.emptySectionTitle} />
          )}
          <View style={styles.sectionBody}>
            {Array.from({ length: section.rows }).map((_, rowIdx) => (
              <View
                key={rowIdx}
                style={[
                  styles.rowWrapper,
                  rowIdx === section.rows - 1 && styles.rowLast,
                ]}
              >
                <SkeletonLine width="60%" height={16} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  emptySectionTitle: {
    // The real SettingsSection renders an empty <Text role="caption"> for empty
    // titles. Text line-height ≈ 18, plus the same md/md margins as titled
    // sections — mirroring keeps the logout section's vertical position
    // stable across skeleton → real.
    height: 18,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionBody: {
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  rowWrapper: {
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
  },
  rowLast: {
    borderBottomWidth: theme.borderWidth.none,
  },
}));

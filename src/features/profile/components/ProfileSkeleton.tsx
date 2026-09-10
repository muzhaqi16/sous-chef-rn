import React from 'react';
import { View } from 'react-native';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from '#components/atoms/Skeleton/SkeletonCircle';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';

const AVATAR_SIZE = 80; // matches ProfileHeader.AVATAR_SIZE
const USER_INFO_HEIGHT = 72; // matches ProfileHeader.USER_INFO_HEIGHT

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

// Dimensions mirror `ProfileHeader` and `SettingRow.rowWrapper` exactly, so the
// layout doesn't shift when real data lands.
export const ProfileSkeleton: React.FC = () => {
  return (
    <ThemedSafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <SkeletonCircle size={44} />
        <SkeletonCircle size={AVATAR_SIZE} />
        <SkeletonCircle size={44} />
      </View>

      {/* Fixed height matches ProfileHeader's expanded `userInfoStyle.height`. */}
      <View style={styles.userInfo}>
        <SkeletonLine width="55%" height={14} />
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
    </ThemedSafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  userInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    height: USER_INFO_HEIGHT,
  },
  section: {
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
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

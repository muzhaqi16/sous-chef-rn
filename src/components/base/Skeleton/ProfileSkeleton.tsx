import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from './SkeletonCircle';
import { SkeletonLine } from './SkeletonLine';

const AVATAR_SIZE = 80; // matches ProfileHeader.AVATAR_SIZE
const USER_INFO_HEIGHT = 72; // matches ProfileHeader.USER_INFO_HEIGHT

/**
 * Rows per section. Mirrors `PROFILE_SETTINGS_CONFIG` in
 * `src/config/settingsConfig.ts`. The Developer section is omitted because
 * `Environment.shouldEnableDebugFeatures()` gates it out for most users.
 * The trailing entry (`hasTitle: false`) is the empty-title logout section.
 */
const SECTIONS: ReadonlyArray<{ rows: number; hasTitle: boolean }> = [
  { rows: 1, hasTitle: true }, // Personal Information
  { rows: 2, hasTitle: true }, // Appearance & Language
  { rows: 1, hasTitle: true }, // Notifications
  { rows: 1, hasTitle: true }, // Dietary Profile
  { rows: 1, hasTitle: true }, // App Settings
  { rows: 2, hasTitle: true }, // Security
  { rows: 1, hasTitle: false }, // Logout
];

/**
 * Skeleton placeholder for the ProfileScreen.
 *
 * Mirrors `ProfileHeader` (back / avatar / more row + userInfo block) and
 * `PROFILE_SETTINGS_CONFIG` (section/row layout) so the layout doesn't shift
 * when real data lands. Row dimensions match `SettingRow.rowWrapper` exactly.
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header row: back button (44) / avatar (80) / more button (44).
          Avatar overlaps the smaller buttons vertically — same as the real
          ProfileHeader. */}
      <View style={styles.header}>
        <SkeletonCircle size={44} />
        <SkeletonCircle size={AVATAR_SIZE} />
        <SkeletonCircle size={44} />
      </View>

      {/* User info block — fixed 72px height matches the expanded
          `userInfoStyle.height` interpolation in ProfileHeader. We render
          only the subtitle (email) line; the optional name line is usually
          empty until the profile loads. */}
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
    </SafeAreaView>
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
    // The real SettingsSection renders an empty <Text size="xs"> for empty
    // titles. Text line-height ≈ 18, plus the same md/md margins as titled
    // sections — mirroring keeps the logout section's vertical position
    // stable across skeleton → real.
    height: 18,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionBody: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  rowWrapper: {
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
}));

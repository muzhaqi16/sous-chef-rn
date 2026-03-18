import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from './SkeletonCircle';
import { SkeletonLine } from './SkeletonLine';

/**
 * Skeleton placeholder for the ProfileScreen.
 * Mirrors the actual ProfileHeader + SettingsSection layout to prevent layout shift.
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header row: back button, avatar, more button */}
      <View style={styles.header}>
        <SkeletonCircle size={44} />
        <SkeletonCircle size={80} />
        <SkeletonCircle size={44} />
      </View>

      {/* Name and email placeholders */}
      <View style={styles.nameContainer}>
        <SkeletonLine width="40%" height={20} />
        <SkeletonLine width="50%" height={14} style={styles.email} />
      </View>

      {/* Settings sections */}
      {[1, 2, 3].map(section => (
        <View key={section} style={styles.section}>
          <SkeletonLine width="30%" height={12} style={styles.sectionTitle} />
          <View style={styles.sectionBody}>
            {[1, 2, 3].map(row => (
              <SkeletonLine
                key={row}
                width="100%"
                height={44}
                style={styles.row}
              />
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
    paddingVertical: 0,
    marginBottom: theme.spacing.sm,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  email: {
    marginTop: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  sectionBody: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    marginVertical: theme.spacing.sm,
  },
}));

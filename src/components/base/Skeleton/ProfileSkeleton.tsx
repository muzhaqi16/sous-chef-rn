import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from './SkeletonCircle';
import { SkeletonLine } from './SkeletonLine';

/**
 * Skeleton placeholder for the ProfileScreen.
 * Shows an avatar circle, name line, and 3 settings sections.
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Avatar + Name */}
      <View style={styles.header}>
        <SkeletonCircle size={80} />
        <SkeletonLine width="50%" height={20} style={styles.nameGap} />
        <SkeletonLine width="35%" height={14} />
      </View>

      {/* Settings sections */}
      {[1, 2, 3].map(section => (
        <View key={section} style={styles.section}>
          <SkeletonLine width="30%" height={14} style={styles.sectionTitle} />
          {[1, 2, 3].map(row => (
            <View key={row} style={styles.row}>
              <SkeletonCircle size={24} />
              <SkeletonLine width="60%" height={16} style={styles.rowText} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  nameGap: {
    marginTop: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
  },
}));

import React from 'react';
import {View, Text} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  description?: string;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  children,
  description,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    marginBottom: theme.spacing.xl,
  },
  headerContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textTertiary || '#999',
    marginTop: theme.spacing.xs,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border || '#E0E0E0',
  },
}));

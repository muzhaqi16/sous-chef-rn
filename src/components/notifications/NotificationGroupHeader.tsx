import React from 'react';
import {View, Text} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

interface NotificationGroupHeaderProps {
  title: string;
}

export const NotificationGroupHeader: React.FC<
  NotificationGroupHeaderProps
> = ({title}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
}));

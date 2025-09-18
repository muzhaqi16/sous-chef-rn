import React from 'react';
import { View, ScrollView } from 'react-native';
import { StyleSheet, Display, mq } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
}

const layoutStyles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
  },

  sidebar: {
    width: 280,
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    padding: theme.spacing.md,

    // Wider sidebar on desktop
    ...{
      ':w[lg]': {
        width: 320,
        padding: theme.spacing.lg,
      },
    },
  },

  mainContent: {
    flex: 1,
    padding: theme.spacing.md,

    // Responsive padding
    ...{
      ':w[0, sm]': {
        padding: theme.spacing.sm,
      },
      ':w[md]': {
        padding: theme.spacing.lg,
      },
      ':w[lg]': {
        padding: theme.spacing.xl,
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
      },
    },
  },

  scrollContent: {
    flexGrow: 1,
  },
}));

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  header,
}) => {
  return (
    <SafeAreaView style={layoutStyles.container}>
      {header}

      <View style={layoutStyles.contentWrapper}>
        {/* Show sidebar only on tablets and desktop */}
        <Display mq={mq.only.width('md')}>
          <View style={layoutStyles.sidebar}>{sidebar}</View>
        </Display>

        <ScrollView
          style={layoutStyles.mainContent}
          contentContainerStyle={layoutStyles.scrollContent}
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

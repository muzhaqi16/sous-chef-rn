import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { Header } from '../molecules/Header';
import { Button } from '../base/Button';
import { commonStyles } from '#/styles';

interface DetailSection {
  title?: string;
  content: React.ReactNode;
}

interface DetailTemplateProps {
  title: string;
  onBack: () => void;
  headerActions?: any[];
  sections: DetailSection[];
  primaryAction?: {
    label: string;
    icon?: React.ComponentProps<typeof Icon>['name'];
    onPress: () => void;
  };
}

export const DetailTemplate: React.FC<DetailTemplateProps> = ({
  title,
  onBack,
  headerActions = [],
  sections,
  primaryAction,
}) => {
  const { theme } = useUnistyles();
  return (
    <View style={styles.container}>
      <Header
        title={title}
        onBack={onBack}
        rightActions={headerActions}
        centerTitle
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingVertical: theme.spacing.md }}
      >
        {sections.map((section, index) => (
          <View key={index} style={[commonStyles.shadow, styles.section]}>
            {section.title && (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            {section.content}
          </View>
        ))}
        {primaryAction && (
          <Button onPress={primaryAction.onPress} icon={primaryAction.icon}>
            {primaryAction.label}
          </Button>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
}));

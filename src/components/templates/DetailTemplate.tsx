import React from 'react';
import {View, ScrollView, Text} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import Icon from '@react-native-vector-icons/material-icons';
import {Header} from '../molecules/Header';
import {Button} from '../base/Button';

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
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <Header
        title={title}
        onBack={onBack}
        actions={headerActions}
        centerTitle
      />
      <ScrollView style={styles.content}>
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            {section.title && (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            {section.content}
          </View>
        ))}
        {primaryAction && (
          <Button
            onPress={primaryAction.onPress}
            icon={primaryAction.icon}
            fullWidth>
            {primaryAction.label}
          </Button>
        )}
      </ScrollView>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
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

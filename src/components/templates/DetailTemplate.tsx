import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Icon } from '#utils/iconUtils';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { Button } from '#components/molecules/Button';
import { DetailSection } from '../molecules/DetailSection';
import { Screen } from './Screen';

interface TemplateSection {
  title?: string;
  content: React.ReactNode;
  transparent?: boolean;
  /** When true, section expands to fill available vertical space (useful for empty states) */
  fill?: boolean;
}

interface DetailTemplateProps {
  title?: string;
  onBack: () => void;
  headerActions?: HeaderAction[];
  sections: TemplateSection[];
  primaryAction?: {
    label: string;
    icon?: React.ComponentProps<typeof Icon>['name'];
    onPress: () => void;
  };
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export const DetailTemplate: React.FC<DetailTemplateProps> = ({
  title,
  onBack,
  headerActions = [],
  sections,
  primaryAction,
  refreshing,
  onRefresh,
}) => (
  <Screen
    header={{ title: title ?? '', back: onBack, actions: headerActions }}
    refresh={
      onRefresh
        ? {
            refreshing: refreshing ?? false,
            onRefresh: () => {
              void onRefresh();
            },
          }
        : undefined
    }
  >
    <View style={styles.sections}>
      {sections.map((section, index) => (
        <DetailSection
          key={index}
          title={section.title}
          transparent={section.transparent}
          fill={section.fill}
        >
          {section.content}
        </DetailSection>
      ))}
      {!!primaryAction && (
        <Button onPress={primaryAction.onPress} icon={primaryAction.icon}>
          {primaryAction.label}
        </Button>
      )}
    </View>
  </Screen>
);

const styles = StyleSheet.create(theme => ({
  sections: {
    flexGrow: 1,
    paddingTop: theme.spacing.md,
  },
}));

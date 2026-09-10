import React from 'react';
import { View, RefreshControl, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '#utils/iconUtils';
import { Header, HeaderVariant } from '../organisms/Header';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { Button } from '#components/molecules/Button';
import { DetailSection } from '../molecules/DetailSection';

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
  /** Header variant preset */
  headerVariant?: HeaderVariant;
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
  headerVariant,
  sections,
  primaryAction,
  refreshing,
  onRefresh,
}) => {
  const insets = useSafeAreaInsets();
  const scrollContentStyle = insets.bottom
    ? [styles.scrollContent, { paddingBottom: insets.bottom }]
    : styles.scrollContent;
  return (
    <View style={styles.container}>
      <Header
        title={title}
        onBack={onBack}
        rightActions={headerActions}
        variant={headerVariant}
        centerTitle
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={scrollContentStyle}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        {/* Sections render through the shared DetailSection card primitive;
            the scroll view already pads horizontally, so the card's own
            horizontal margin is canceled. */}
        {sections.map((section, index) => (
          <DetailSection
            key={index}
            title={section.title}
            transparent={section.transparent}
            fill={section.fill}
            style={styles.templateSection}
          >
            {section.content}
          </DetailSection>
        ))}
        {!!primaryAction && (
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
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  templateSection: {
    marginHorizontal: 0,
  },
}));

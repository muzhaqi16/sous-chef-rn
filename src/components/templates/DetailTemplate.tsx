import React from 'react';
import { View, RefreshControl, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '#utils/iconUtils';
import { Header, HeaderAction, HeaderVariant } from '../molecules/Header';
import { Button } from '../base/Button';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

interface DetailSection {
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
  sections: DetailSection[];
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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={{
          flexGrow: 1,
          paddingVertical: theme.spacing.sm,
          paddingBottom: insets.bottom || theme.spacing.sm,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        {sections.map((section, index) => (
          <View
            key={index}
            style={[
              !section.transparent && commonStyles.shadow,
              section.transparent ? styles.transparentSection : styles.section,
              section.fill && { flex: 1 },
            ]}
          >
            {!!section.title && (
              <Text
                size="md"
                weight="semibold"
                tone="primary"
                style={styles.sectionTitle}
              >
                {section.title}
              </Text>
            )}
            {section.content}
          </View>
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
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  transparentSection: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing['3'],
  },
}));

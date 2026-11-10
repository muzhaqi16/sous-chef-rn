import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import { IconButton } from '#components/atoms/IconButton';
import { ProgressBar } from '#components/atoms/ProgressBar';
import { AppPressable } from '#components/atoms/AppPressable';
import { Button } from '#components/molecules/Button';
import type { GettingStartedItem } from '#features/today/hooks/useGettingStarted';
import { todayTestIDs } from '#features/today/testIDs';

interface GettingStartedCardProps {
  items: { id: GettingStartedItem; done: boolean }[];
  doneCount: number;
  allDone: boolean;
  onStart: (item: GettingStartedItem) => void;
  onHide: () => void;
}

const LABEL_KEYS: Record<GettingStartedItem, TranslationKey> = {
  stock: 'today.gettingStarted.stock',
  shop: 'today.gettingStarted.shop',
  cook: 'today.gettingStarted.cook',
  plan: 'today.planMeal',
};

/**
 * The first things worth doing on a new account, each ticked from what the
 * account has done. The first undone one carries the button that starts it.
 */
export const GettingStartedCard = ({
  items,
  doneCount,
  allDone,
  onStart,
  onHide,
}: GettingStartedCardProps) => {
  const { t } = useTranslation();
  const progress = t('today.gettingStarted.progress', {
    done: doneCount,
    total: items.length,
  });

  if (allDone) {
    return (
      <Card radius="xl" testID={todayTestIDs.gettingStarted}>
        <View style={styles.allDone}>
          <Icon name="checkmark-circle" size={28} tone="primary" />
          <View style={styles.flex}>
            <Text role="heading">{t('today.gettingStarted.allDoneTitle')}</Text>
            <Text role="body" tone="secondary">
              {t('today.gettingStarted.allDoneBody')}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const firstUndone = items.find(item => !item.done)?.id;
  return (
    <Card radius="xl" testID={todayTestIDs.gettingStarted}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text role="heading" accessibilityRole="header">
            {t('today.gettingStarted.title')}
          </Text>
          <Text role="caption" tone="secondary">
            {progress}
          </Text>
        </View>
        <IconButton
          name="close"
          onPress={onHide}
          accessibilityLabel={t('today.gettingStarted.hide')}
          testID={todayTestIDs.gettingStartedHide}
        />
      </View>
      <ProgressBar
        value={items.length > 0 ? doneCount / items.length : 0}
        size="sm"
        accessibilityLabel={progress}
      />
      <View style={styles.items}>
        {items.map(({ id, done }) => {
          const label = t(LABEL_KEYS[id]);
          const offered = id === firstUndone;
          return (
            <AppPressable
              key={id}
              onPress={done ? undefined : () => onStart(id)}
              disabled={done}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ checked: done, disabled: done }}
              style={styles.item}
              testID={todayTestIDs.gettingStartedItem(id)}
            >
              <Icon
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                tone={done ? 'primary' : 'textTertiary'}
              />
              <Text
                role={offered ? 'bodyStrong' : 'body'}
                tone={done ? 'secondary' : undefined}
                style={styles.flex}
              >
                {label}
              </Text>
              {offered ? (
                <Button
                  title={t('today.gettingStarted.start')}
                  size="small"
                  onPress={() => onStart(id)}
                  testID={todayTestIDs.gettingStartedStart}
                />
              ) : null}
            </AppPressable>
          );
        })}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  items: {
    marginTop: theme.spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.sizes.touchTarget.min,
  },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
}));

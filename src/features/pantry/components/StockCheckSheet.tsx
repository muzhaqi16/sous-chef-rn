import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { DataStateView } from '#components/organisms/DataStateView';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { FractionInput } from '#components/molecules/FractionInput';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  StockCheckAnswer,
  StockDoubtReason,
} from '#/graphql/generated/schemaTypes';
import {
  useStockCheck,
  type StockCheckChoice,
  type StockCheckRow,
} from '../hooks/useStockCheck';
import { pantryTestIDs } from '../testIDs';

const ANSWERS: readonly StockCheckAnswer[] = [
  StockCheckAnswer.StillHave,
  StockCheckAnswer.SomeLeft,
  StockCheckAnswer.UsedUp,
  StockCheckAnswer.ThrewOut,
];

const answerLabel = (answer: StockCheckAnswer): TranslationKey => {
  switch (answer) {
    case StockCheckAnswer.SomeLeft:
      return 'pantryScreen.stockCheckSomeLeft';
    case StockCheckAnswer.UsedUp:
      return 'pantryScreen.stockCheckUsedUp';
    case StockCheckAnswer.ThrewOut:
      return 'pantryScreen.stockCheckThrewOut';
    case StockCheckAnswer.StillHave:
    default:
      return 'pantryScreen.stockCheckStillHave';
  }
};

/** Why the server doubts a stack, in the app's words; null for one this build predates. */
const reasonLabel = (reason: StockDoubtReason): TranslationKey | null => {
  switch (reason) {
    case StockDoubtReason.NotConfirmedRecently:
      return 'pantryScreen.stockDoubtNotConfirmed';
    case StockDoubtReason.PastExpiry:
      return 'pantryScreen.stockDoubtPastExpiry';
    case StockDoubtReason.PastPredictedRunOut:
      return 'pantryScreen.stockDoubtPastRunOut';
    case StockDoubtReason.PredictedRunOutSoon:
      return 'pantryScreen.stockDoubtRunOutSoon';
    default:
      return null;
  }
};

interface StockCheckSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Up to five doubtful stacks, each answered Still have, Some left, Used up or
 * Threw out. Only answered rows are sent; closing leaves the rest as they were.
 */
export const StockCheckSheet: React.FC<StockCheckSheetProps> = ({
  visible,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const { rows, state, retry, answer } = useStockCheck(visible);
  const [choices, setChoices] = useState<
    Partial<Record<string, StockCheckAnswer>>
  >({});
  const [left, setLeft] = useState<Partial<Record<string, string>>>({});
  const [inside, setInside] = useState<Partial<Record<string, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);

  const choiceOf = (
    row: StockCheckRow,
  ): StockCheckChoice | null | 'invalid' => {
    const picked = choices[row.id];
    if (!picked) return null;
    if (picked === StockCheckAnswer.StillHave) {
      return { answer: StockCheckAnswer.StillHave };
    }
    if (picked === StockCheckAnswer.UsedUp) {
      return { answer: StockCheckAnswer.UsedUp };
    }
    if (picked === StockCheckAnswer.ThrewOut) {
      return { answer: StockCheckAnswer.ThrewOut };
    }
    const quantity = parseFractionalInput(left[row.id] ?? '');
    if (quantity === null || quantity < 0) return 'invalid';
    // What the packages found hold, as a recount takes it: never a fraction
    // of a package worked out by hand.
    const held = (inside[row.id] ?? '').trim();
    if (!held || !row.contents) {
      return { answer: StockCheckAnswer.SomeLeft, quantity };
    }
    const amount = parseFractionalInput(held);
    return amount === null || amount < 0
      ? 'invalid'
      : {
          answer: StockCheckAnswer.SomeLeft,
          quantity,
          contents: { amount, unitId: row.contents.unitId },
        };
  };

  const save = async () => {
    const found: Partial<Record<string, string>> = {};
    const answered = rows.flatMap(row => {
      const choice = choiceOf(row);
      if (choice === 'invalid') {
        found[row.id] = t('errors.invalidQuantity');
        return [];
      }
      return choice ? [{ row, choice }] : [];
    });
    setErrors(found);
    if (Object.keys(found).length > 0 || answered.length === 0) return;
    setSaving(true);
    const { status, refused } = await answer(answered);
    setSaving(false);
    if (status === 'failed') return;
    if (refused.length === 0) {
      onDismiss();
      return;
    }
    // A stack that moved since it was seen keeps its row, to be counted again.
    setErrors(
      Object.fromEntries(
        refused.map(id => [id, t('pantryScreen.stockCheckStale')]),
      ),
    );
    setChoices(current =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => refused.includes(id)),
      ),
    );
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      title={t('pantryScreen.stockCheckTitle')}
      snapPoints={['85%']}
      contentContainerStyle={styles.content}
    >
      {/* A check the device cannot read says so, never an empty check. */}
      {rows.length === 0 ? (
        <DataStateView state={state} onRetry={retry} />
      ) : null}
      {rows.map(row => {
        const picked = choices[row.id] ?? null;
        const reasons = row.reasons
          .map(reasonLabel)
          .filter((key): key is TranslationKey => key !== null)
          .map(key => t(key));
        return (
          <View
            key={row.id}
            style={styles.row}
            testID={pantryTestIDs.stockCheckRow(row.id)}
          >
            <View style={styles.rowHead}>
              <Text role="bodyStrong" style={styles.name}>
                {row.name}
              </Text>
              <Text role="body" tone="secondary">
                {row.amount}
              </Text>
            </View>
            {reasons.length > 0 ? (
              <Text role="caption" tone="secondary">
                {reasons.join(' · ')}
              </Text>
            ) : null}
            <ChipScrollRow
              options={ANSWERS.map(option => ({
                key: option,
                label: t(answerLabel(option)),
                testID: pantryTestIDs.stockCheckAnswer(row.id, option),
              }))}
              selected={picked}
              onSelect={key => {
                const next = ANSWERS.find(option => option === key);
                if (!next) return;
                setChoices(current => ({ ...current, [row.id]: next }));
              }}
              edgeFadeColor="surface"
            />
            {picked === StockCheckAnswer.SomeLeft ? (
              <>
                <FractionInput
                  label={t('pantryScreen.stockCheckLeft', {
                    unit: row.unitSymbol,
                  })}
                  value={left[row.id] ?? ''}
                  onChangeText={text =>
                    setLeft(current => ({ ...current, [row.id]: text }))
                  }
                  error={errors[row.id]}
                  testID={pantryTestIDs.stockCheckLeft(row.id)}
                />
                {row.contents ? (
                  <FractionInput
                    label={t('pantryScreen.stockCheckInside', {
                      unit: row.contents.unitSymbol,
                    })}
                    value={inside[row.id] ?? ''}
                    onChangeText={text =>
                      setInside(current => ({ ...current, [row.id]: text }))
                    }
                  />
                ) : null}
              </>
            ) : errors[row.id] ? (
              <Text role="error" tone="error">
                {errors[row.id]}
              </Text>
            ) : null}
          </View>
        );
      })}
      <Button
        title={t('labels.save')}
        onPress={() => {
          void save();
        }}
        loading={saving}
        disabled={saving}
        testID={pantryTestIDs.stockCheckSave}
      />
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    gap: theme.spacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
  },
}));

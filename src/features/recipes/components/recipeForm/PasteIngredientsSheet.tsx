import React, { useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Text } from '#components/atoms/Text';
import { useIngredientPaste } from '#features/recipes/hooks/useIngredientPaste';
import {
  capPastedText,
  pastedLines,
  type PastedIngredient,
} from '#features/recipes/utils/pastedIngredients';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useOpening } from '#hooks/ui/useOpening';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

interface PasteFormProps {
  room: number;
  onClose: () => void;
  onPasted: (rows: PastedIngredient[]) => void;
}

const PasteForm: React.FC<PasteFormProps> = ({ room, onClose, onPasted }) => {
  const { t } = useTranslation();
  const { parseLines, parsing, unavailable } = useIngredientPaste();
  const [text, setText] = useState('');
  // Set by an Add with nothing pasted; typing clears it.
  const [empty, setEmpty] = useState(false);
  useSheetUnsavedInput(text.trim() !== '');
  const lines = pastedLines(text);

  const add = async () => {
    if (lines.length === 0) {
      setEmpty(true);
      return;
    }
    const rows = await parseLines(lines);
    if (!rows) return;
    onPasted(rows);
    onClose();
  };

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('recipes.pasteIngredients')}
          onClose={onClose}
          // A full recipe offers nothing to add; offline, the note says why.
          confirm={
            room === 0
              ? undefined
              : {
                  onPress: () => {
                    void add();
                  },
                  accessibilityLabel: t('recipes.addIngredientsCount', {
                    count: lines.length,
                  }),
                  loading: parsing,
                  disabled: unavailable,
                  testID: recipesTestIDs.pasteIngredientsAdd,
                }
          }
        />
      </SheetHeaderSlot>
      {room === 0 ? (
        <Text role="body" tone="secondary">
          {t('recipes.pasteIngredientsFull')}
        </Text>
      ) : (
        <>
          <FormTextArea
            label={t('recipes.pasteIngredientsLabel')}
            value={text}
            onChangeText={next => {
              setText(capPastedText(next, room));
              setEmpty(false);
            }}
            error={empty ? t('recipes.pasteIngredientsRequired') : undefined}
            placeholder={t('recipes.pasteIngredientsPlaceholder')}
            numberOfLines={8}
            editable={!parsing}
            testID={recipesTestIDs.pasteIngredientsInput}
          />
          <Text role="caption" tone="secondary" style={styles.note}>
            {t('recipes.pasteIngredientsRoom', { count: room })}
          </Text>
          {unavailable ? (
            <Text role="caption" tone="warning" style={styles.note}>
              {t('recipes.pasteIngredientsOffline')}
            </Text>
          ) : null}
        </>
      )}
    </>
  );
};

interface PasteIngredientsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** How many more ingredients the recipe can hold. */
  room: number;
  onPasted: (rows: PastedIngredient[]) => void;
}

/** Pasted lines, read by the server's parser, become the form's next rows. */
export const PasteIngredientsSheet: React.FC<PasteIngredientsSheetProps> = ({
  visible,
  onDismiss,
  room,
  onPasted,
}) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['80%']}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <PasteForm
          key={opening.id}
          room={room}
          onClose={onDismiss}
          onPasted={onPasted}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingBottom: theme.spacing.md,
  },
  note: {
    marginBottom: theme.spacing.md,
  },
}));

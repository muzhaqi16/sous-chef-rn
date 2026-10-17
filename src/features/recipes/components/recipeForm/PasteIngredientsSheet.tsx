import React, { useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { useIngredientPaste } from '#features/recipes/hooks/useIngredientPaste';
import {
  capPastedText,
  pastedLines,
  type PastedIngredient,
} from '#features/recipes/utils/pastedIngredients';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface PasteFormProps {
  room: number;
  onClose: () => void;
  onPasted: (rows: PastedIngredient[]) => void;
}

const PasteForm: React.FC<PasteFormProps> = ({ room, onClose, onPasted }) => {
  const { t } = useTranslation();
  const { parseLines, parsing, unavailable } = useIngredientPaste();
  const [text, setText] = useState('');
  const lines = pastedLines(text);

  const add = async () => {
    const rows = await parseLines(lines);
    if (!rows) return;
    onPasted(rows);
    onClose();
  };

  return (
    <>
      <SheetHeader
        contentPadding="md"
        title={t('recipes.pasteIngredients')}
        onClose={onClose}
      />
      {room === 0 ? (
        <Text role="body" tone="secondary">
          {t('recipes.pasteIngredientsFull')}
        </Text>
      ) : (
        <>
          <FormTextArea
            label={t('recipes.pasteIngredientsLabel')}
            value={text}
            onChangeText={next => setText(capPastedText(next, room))}
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
          <Button
            onPress={() => {
              void add();
            }}
            loading={parsing}
            disabled={unavailable || lines.length === 0}
            testID={recipesTestIDs.pasteIngredientsAdd}
          >
            {t('recipes.addIngredientsCount', { count: lines.length })}
          </Button>
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
  // A fresh field per opening, kept while the sheet animates out.
  const [opening, setOpening] = useState(0);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setOpening(opening + 1);
  }

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['80%']}
      contentContainerStyle={styles.content}
    >
      {opening > 0 ? (
        <PasteForm
          key={opening}
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
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  note: {
    marginBottom: theme.spacing.md,
  },
}));

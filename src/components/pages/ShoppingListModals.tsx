import React, {useRef, useState} from 'react';
import {View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import AddItemBottomSheet from '../organisms/AddItemBottomSheet';
import ItemDetailBottomSheet from '../molecules/ItemDetailBottomSheet';
import {BottomSheetAction} from '../templates/BottomSheetAction';
import {ActionButton} from '../molecules';

interface Selected {
  id?: string;
  name: string;
}

export const ShoppingListModals: React.FC = () => {
  const addRef = useRef<import('@gorhom/bottom-sheet').BottomSheetModal>(null);
  const detailRef =
    useRef<import('@gorhom/bottom-sheet').BottomSheetModal>(null);
  const [detailItem, setDetailItem] = useState<Selected | null>(null);
  const {styles, theme} = useStyles(stylesheet);

  const goToDetails = (item: Selected) => {
    setDetailItem(item);
    addRef.current?.dismiss();
    setTimeout(() => detailRef.current?.present(), 200);
  };

  return (
    <View>
      <ActionButton
        name={'add'}
        onPress={() => addRef.current?.present()}
        style={styles.button}
        color={theme.colors.primary}
      />
      {/* — ADD ITEM SHEET — */}
      <BottomSheetAction
        sheetRef={addRef}
        snapPoints={['50%', '75%']}
        sheetTitle="Add Item to Shopping List">
        <AddItemBottomSheet onGoToDetails={goToDetails} />
      </BottomSheetAction>

      {/* — DETAIL / EDIT SHEET — */}
      <BottomSheetAction
        sheetRef={detailRef}
        snapPoints={['75%', '90%']}
        sheetTitle={detailItem ? `Edit ${detailItem.name}` : undefined}>
        {detailItem && (
          <ItemDetailBottomSheet
            item={detailItem}
            onClose={() => detailRef.current?.dismiss()}
          />
        )}
      </BottomSheetAction>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    backgroundColor: theme.colors.background,
  },
}));

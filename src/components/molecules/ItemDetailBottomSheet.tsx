import React, {useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import QuantitySelector from '../organisms/QuantitySelector';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import Button from '../atoms/Button/Button';
import {useUpdateShoppingListItemMutation} from '../../graphql/generated';
import {useUnitsQuery, Unit} from '../../graphql/generated';
import {ShoppingListItemDetail} from '../../types';

interface ItemDetailProps {
  item: ShoppingListItemDetail;
  onClose: () => void;
  onUpdate: (updates: Partial<ShoppingListItemDetail>) => void;
  onRemove: () => void;
}

export const ItemDetailBottomSheet: React.FC<ItemDetailProps> = ({
  item,
  onClose,
}) => {
  const [name, setName] = useState(item.itemName || '');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const {data} = useUnitsQuery();

  const [updateItem] = useUpdateShoppingListItemMutation({
    onCompleted: () => onClose(),
    onError: e => console.error('Update error', e),
  });

  const handleSave = () => {
    updateItem({
      variables: {
        id: item.id,
        input: {
          itemName: item.itemName,
          quantity,
        },
      },
    });
  };
  return (
    <View style={styles.container}>
      <View style={styles.inputs}>
        <BottomSheetTextInput
          placeholder="Enter item name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {}}
        />
        <QuantitySelector
          quantity={quantity}
          onDecrement={() => setQuantity(q => Math.max(1, q - 1))}
          onIncrement={() => setQuantity(q => q + 1)}
          unit={unit}
          onUnitChange={setUnit}
          units={data?.units as Unit[]}
        />
      </View>
      <Button title="Save" onPress={handleSave} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  inputs: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 8,
    backgroundColor: 'white',
  },
}));

export default ItemDetailBottomSheet;

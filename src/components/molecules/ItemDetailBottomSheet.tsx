import React, {useState} from 'react';
import QuantitySelector from '../organisms/QuantitySelector';
import Button from '../atoms/Button';
import {useStore} from '../../store';
import {useUpdateShoppingListItemMutation} from '../../graphql/generated';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useUnitsQuery} from '../../graphql/generated';
interface Selected {
  id?: string;
  name: string;
}
interface ItemDetailProps {
  item: Selected;
  onClose: () => void;
}

export const ItemDetailBottomSheet: React.FC<ItemDetailProps> = ({
  item,
  onClose,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const {data} = useUnitsQuery();
  const units = data?.units || [];
  const shoppingListId = useStore(state => state.selectedShoppingListId);

  const [updateItem] = useUpdateShoppingListItemMutation({
    onCompleted: () => onClose(),
    onError: e => console.error('Update error', e),
  });

  const handleSave = () => {
    updateItem({
      variables: {
        id: item.id || '',
        data: {
          shoppingListId: shoppingListId || '',
          itemId: item.id || '',
          itemName: item.name,
          quantity,
        },
      },
    });
  };

  return (
    <>
      <QuantitySelector
        quantity={quantity}
        onDecrement={() => setQuantity(q => Math.max(1, q - 1))}
        onIncrement={() => setQuantity(q => q + 1)}
        unit={unit}
        onUnitChange={setUnit}
        units={units}
      />
      <Button title="Save" onPress={handleSave} />
      <Button title="Cancel" onPress={onClose} btnStyle={{marginTop: 8}} />
    </>
  );
};

const stylesheet = createStyleSheet(theme => ({
  errorText: {color: 'red', marginTop: 10},
}));

export default ItemDetailBottomSheet;

import React, {useState} from 'react';
import QuantitySelector from '../organisms/QuantitySelector';
import Button from '../atoms/Button';
import {useUpdateShoppingListItemMutation} from '../../graphql/generated';
import {useUnitsQuery, ShoppingListItem} from '../../graphql/generated';

interface ItemDetailProps {
  item: ShoppingListItem;
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

  const [updateItem] = useUpdateShoppingListItemMutation({
    onCompleted: () => onClose(),
    onError: e => console.error('Update error', e),
  });

  const handleSave = () => {
    updateItem({
      variables: {
        id: item.id || '',
        data: {
          itemName: item.itemName,
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

export default ItemDetailBottomSheet;

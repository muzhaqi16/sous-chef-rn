import {useEffect} from 'react';
import {PickerSelect} from '../../components/atoms/Picker';
import {useStore} from '../../store/useStore';

export const ShoppingListSector = () => {
  const {
    defaultShoppingList,
    setDefaultShoppingList,
    shoppingLists,
    fetchShoppingLists,
  } = useStore();

  useEffect(() => {
    fetchShoppingLists();
  }, []);

  return (
    <PickerSelect
      items={shoppingLists.map((list: any) => ({id: list.id, name: list.name}))}
      initialValue={defaultShoppingList?.id || ''}
      onValueChange={id => {
        const selectedList = shoppingLists.find(list => list.id === id);
        if (selectedList) {
          setDefaultShoppingList(selectedList);
        } else {
          // Optionally handle the error, e.g. show an error message or fallback logic
          console.error('No shopping list found for id:', id);
        }
      }}
    />
  );
};

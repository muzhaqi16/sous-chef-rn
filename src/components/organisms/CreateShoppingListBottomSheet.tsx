import React, {useState, useRef} from 'react';
import {Text, StyleSheet} from 'react-native';
import BottomSheet, {BottomSheetRef} from '../pages/BottomSheet';
import {Button} from '../atoms/Button/Button';
import {BaseInput as Input} from '../atoms';
import {useCreateShoppingListMutation} from '../../graphql/generated';

const CreateShoppingListBottomSheet: React.FC = ({}) => {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [listName, setListName] = useState('');
  const [renderBottomSheet, setRenderBottomSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createShoppingList] = useCreateShoppingListMutation();

  const handleShow = () => {
    setRenderBottomSheet(true);
    bottomSheetRef.current?.expand();
  };

  const handleCreateList = async () => {
    if (!listName.trim()) {
      return;
    }
    try {
      await createShoppingList({
        variables: {
          input: {
            name: listName.trim(),
            isDefault: true, // Assuming you want to set this as default
            tags: ['onboarding'], // Example tag, you can modify or add more
          },
        },
      });
      bottomSheetRef.current?.close();
      setListName('');
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <Button
        title="Create Shopping List"
        onPress={handleShow}
        style={{margin: 16}}
      />
      {renderBottomSheet && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['40%', '60%']}
          enableDynamicSizing={false}>
          <Input
            placeholder="List name"
            value={listName}
            onChangeText={setListName}
          />
          <Button title="Create" onPress={handleCreateList} />
          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </BottomSheet>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: 'red',
    marginTop: 10,
  },
});

export default CreateShoppingListBottomSheet;

import React, {useState, useRef} from 'react';
import {Text, StyleSheet} from 'react-native';
import BottomSheet, {BottomSheetRef} from '../pages/BottomSheet';
import {Button} from "../base/Button";
import {EmailInput} from '../atoms';
import {useStore} from '../../store';
import {
  useAddCollaboratorMutation,
  CollaboratorRole,
} from '../../graphql/generated';

const ShareShoppingListBottomSheet: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [email, setEmail] = useState('');
  const [renderBottomSheet, setRenderBottomSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {selectedShoppingListId} = useStore();
  const shoppingListId = selectedShoppingListId;
  const [shareShoppingList] = useAddCollaboratorMutation();

  const handleShow = () => {
    setRenderBottomSheet(true);
    bottomSheetRef.current?.expand();
  };

  const handleShare = async () => {
    if (!shoppingListId || !email.trim()) {
      return;
    }
    try {
      await shareShoppingList({
        variables: {
          data: {
            shoppingListId,
            email: email.trim(),
            role: CollaboratorRole.Viewer, // Assuming you want to set this as collaborator
          },
        },
      });
      bottomSheetRef.current?.close();
      setEmail('');
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <Button
        onPress={handleShow}
        style={{margin: 16}}>
        Share Shopping List
      </Button>
      {renderBottomSheet && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['40%', '60%']}
          enableDynamicSizing={false}>
          <EmailInput
            label="User email"
            value={email}
            onChangeText={setEmail}
          />
          <Button onPress={handleShare}>Share</Button>
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

export default ShareShoppingListBottomSheet;

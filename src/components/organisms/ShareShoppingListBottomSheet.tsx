import React, {useState, useRef} from 'react';
import {Text, StyleSheet} from 'react-native';
import BottomSheet, {BottomSheetRef} from '../pages/BottomSheet';
import Button from '../atoms/Button';
import EmailInput from '../atoms/EmailInput';
import {useStore} from '../../store/useStore';

const ShareShoppingListBottomSheet: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [email, setEmail] = useState('');
  const [renderBottomSheet, setRenderBottomSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shoppingListId = useStore(state => state.defaultShoppingList?.id);
  const shareShoppingList = useStore(state => state.shareShoppingList);

  const handleShow = () => {
    setRenderBottomSheet(true);
    bottomSheetRef.current?.expand();
  };

  const handleShare = async () => {
    if (!shoppingListId || !email.trim()) {
      return;
    }
    try {
      await shareShoppingList(shoppingListId, email.trim());
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
        title="Share Shopping List"
        onPress={handleShow}
        style={{margin: 16}}
      />
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
          <Button title="Share" onPress={handleShare} />
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

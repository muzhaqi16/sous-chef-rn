import React, {useState} from 'react';
import {TouchableOpacity, Text, View, ActivityIndicator} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useQuery, useMutation} from '@apollo/client';
import {OnBoardingWrapper} from '../../components/templates';
import {useNavigation} from '@react-navigation/native';
import {CreateShoppingListNavProp} from '../../navigation/types';
import {GET_ONBOARDING_PANTRY_ITEMS} from '../../api/graphql/queries/pantry';
import {ADD_ITEM_TO_PANTRY} from '../../api/graphql/mutations/pantry';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const SelectPantryItems = () => {
  const navigation = useNavigation<CreateShoppingListNavProp>();
  const {styles} = useStyles(stylesheet);

  // fetch onboarding items
  const {
    data,
    loading,
    error: queryError,
  } = useQuery(GET_ONBOARDING_PANTRY_ITEMS);

  // mutation to add items to pantry
  const [addItemToPantry, {error: mutationError}] = useMutation(
    ADD_ITEM_TO_PANTRY,
    {
      onCompleted: data => {
        console.log('Item added to pantry:', data);
        // Optionally navigate to next step or show success message
        navigation.replace('Home', {screen: 'Main'});
      },
      onError: error => {
        console.error('Error adding item to pantry:', error);
        // Handle error, e.g., show a message to the user
      },
    },
  );

  // local selection state
  const [selected, setSelected] = useState<string[]>([]);
  const handleSelect = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
    } else if (selected.length < 3) {
      setSelected([...selected, id]);
    }
  };

  const onNext = () => {
    if (selected.length === 0) {
      console.warn('No items selected');
      return;
    }

    // Add selected items to pantry
    selected.forEach(itemId => {
      addItemToPantry({
        variables: {
          input: {
            itemId,
          },
        },
      });
    });

    // Optionally navigate to next step or show success message
    navigation.replace('OnBoarding', {screen: 'AddFriends'});
  };

  return (
    <OnBoardingWrapper
      title="Select pantry items"
      subtitle="Choose a few items that you might already have"
      step={2}
      totalSteps={4}
      onBack={() => navigation.goBack()}
      onSkip={() => navigation.replace('Home', {screen: 'ShoppingList'})}>
      {loading && <ActivityIndicator style={styles.loader} />}

      {queryError && (
        <Text style={styles.errorText}>
          Unable to load items. Please try again.
        </Text>
      )}

      {!loading && data && (
        <KeyboardAwareScrollView style={styles.form}>
          <View style={styles.picker}>
            {data.onBoardingPantryItems.map(
              (item: {id: string; name: string}) => {
                const active = selected.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleSelect(item.id)}
                    style={[
                      styles.pickerItem,
                      active && styles.pickerItemActive,
                    ]}>
                    <Text
                      style={[
                        styles.pickerLabel,
                        active && styles.pickerLabelActive,
                      ]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>
        </KeyboardAwareScrollView>
      )}

      <TouchableOpacity
        onPress={onNext}
        style={[
          styles.nextButton,
          selected.length === 0 && styles.nextButtonDisabled,
        ]}
        disabled={selected.length === 0}>
        <Text style={styles.nextText}>Next</Text>
      </TouchableOpacity>
    </OnBoardingWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
  form: {
    flex: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerItem: {
    margin: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c9d3db',
    borderRadius: 12,
  },
  pickerItemActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
  },
  pickerLabelActive: {
    color: theme.colors.white,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginVertical: 12,
  },
  loader: {
    marginVertical: 24,
  },
}));

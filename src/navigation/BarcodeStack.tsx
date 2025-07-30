import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {type BarcodeStackParamList} from './types';

import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';

const Stack = createNativeStackNavigator<BarcodeStackParamList>();

const BarcodeStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="BarcodeScanner"
      screenOptions={{headerShown: false}}>
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{
          title: 'Scan Barcode',
          headerShown: false, // We have custom header
        }}
      />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{
          title: 'Search Results',
          headerShown: false, // We have custom header
        }}
      />
    </Stack.Navigator>
  );
};

export default BarcodeStack;

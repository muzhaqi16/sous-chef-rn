import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import {useStore} from '../store/useStore';
import {type RootStackParamList} from './types';
import HomeTab from './TabNavigator';
import AuthStack from './AuthStack';
import OnboardingStack from './OnboardingStack';
import {NotFoundScreen} from '../screens/NotFoundScreen'; // Adjust the import path as necessary

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const {user} = useStore();
  const isSignedIn = !!user;
  return (
    <NavigationContainer>
      {isSignedIn ? (
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{headerShown: false}}>
          <Stack.Screen name="Home" component={HomeTab} />
          <Stack.Screen name="OnBoarding" component={OnboardingStack} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          initialRouteName="Auth"
          screenOptions={{headerShown: false}}>
          <Stack.Screen name="Auth" component={AuthStack} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;

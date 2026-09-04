import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';
import { settingsScreenOptions } from '#navigation/detailScreenOptions';

const PerformanceDashboard = React.lazy(() => import('./PerformanceDashboard'));
const DebugInfo = React.lazy(() => import('./DebugInfo'));

/**
 * The developer screens. Registered by `profileScreens`, which is where they
 * are reached from — the same arrangement notification settings has.
 */
export const devtoolsScreens = {
  PerformanceDashboard: createNativeStackScreen({
    screen: PerformanceDashboard,
    options: settingsScreenOptions,
    linking: null,
  }),
  DebugInfo: createNativeStackScreen({
    screen: DebugInfo,
    options: settingsScreenOptions,
    linking: null,
  }),
};

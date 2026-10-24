import type { FeatureManifest } from '../types';
import { TodayStack } from '#navigation/stacks/TodayStack';

export const todayFeature: FeatureManifest = {
  id: 'today',
  tab: {
    screenName: 'Today',
    titleKey: 'labels.today',
    order: 5,
    icon: { active: 'sunny', inactive: 'sunny-outline' },
    mainScreen: 'TodayMain',
    stack: TodayStack,
  },
};

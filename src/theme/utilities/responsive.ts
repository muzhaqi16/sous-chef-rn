import {mq} from 'react-native-unistyles';

export const responsive = {
  // Breakpoint helpers
  isSmallScreen: mq.only.width(0, 'sm'),
  isMediumScreen: mq.only.width('sm', 'md'),
  isLargeScreen: mq.only.width('md'),
  isTablet: mq.only.width('md', 'lg'),
  isDesktop: mq.only.width('lg'),

  // Orientation helpers
  isPortrait: mq.height(0, 1000).and.width(0, 768),
  isLandscape: mq.only.width(768),
};

import { testRule } from '#/test-utils/eslintRuleTester';

const HOST =
  'import { SwipeAwareScrollComponent } from "#components/atoms/SwipeAwareScrollComponent";\n';

testRule('rngh-refresh-control-matches-host', {
  valid: [
    `${HOST}const C = () => <FlashList data={rows} onRefresh={f} refreshControl={<ThemedRefreshControl refreshing={x} onRefresh={f} />} renderScrollComponent={SwipeAwareScrollComponent} />;`,
    // No pull-to-refresh: nothing to match.
    `${HOST}const C = () => <FlashList data={rows} renderScrollComponent={SwipeAwareScrollComponent} />;`,
    // A plain RN host may import RN's control.
    'import { RefreshControl } from "react-native";\nconst C = () => <ScrollView refreshControl={<RefreshControl />} />;',
    // RNGH's ScrollView reached through the shared host is the supported path.
    'import { ScrollView } from "react-native-gesture-handler";\nconst C = () => <SwipeAwareScrollComponent refreshControl={<ThemedRefreshControl />} />;',
  ],
  invalid: [
    {
      // FlashList builds RN's control itself when given a bare onRefresh.
      code: `${HOST}const C = () => <FlashList data={rows} onRefresh={f} renderScrollComponent={SwipeAwareScrollComponent} />;`,
      errors: ['bareOnRefresh'],
    },
    {
      code: `${HOST}const C = () => <FlashList data={rows} onRefresh={f} refreshControl={<RefreshControl />} renderScrollComponent={SwipeAwareScrollComponent} />;`,
      errors: ['wrongControl'],
    },
    {
      code: `import { RefreshControl } from "react-native";\n${HOST}const C = () => <FlashList data={rows} renderScrollComponent={SwipeAwareScrollComponent} />;`,
      errors: ['rnImportWithRnghHost'],
    },
    {
      // Throws at runtime: no InterceptingGestureDetector above it.
      code: 'const C = () => <View><ThemedRefreshControl /></View>;',
      errors: ['themedControlWithoutRnghHost'],
    },
    {
      code: 'import { ScrollView } from "react-native-gesture-handler";\nconst C = () => <ScrollView refreshControl={<ThemedRefreshControl />} />;',
      errors: ['handRolledRnghScroller'],
    },
  ],
});

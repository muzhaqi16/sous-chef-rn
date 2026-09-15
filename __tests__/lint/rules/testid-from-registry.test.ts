import { testRule } from '#/test-utils/eslintRuleTester';

testRule('testid-from-registry', {
  valid: [
    'const a = <View testID={pantryTestIDs.list} />;',
    'const b = <Row testID={kitTestIDs.swipeAction(prefix, action.key)} />;',
    'const c = <Field testID={testID ? catalogTestIDs.autocompleteSearch(testID) : undefined} />;',
    'const d = { testIDPrefix: pantryTestIDs.addItemSheetPrefix };',
    'element(by.id(kitTestIDs.headerBackButton));',
    // Data the spec entered is matched by its variable.
    'element(by.text(itemName));',
    'element(by.text(`${name} Edited`));',
    'element(by.label(ITEMS.apple));',
    // An OS alert has no testID; the system matcher is the only reach.
    "system.element(by.system.label('Not Now')).tap();",
    'element(by.id(kitTestIDs.tabBar)).tap();',
    'element(by.id(kitTestIDs.tabBar)).longPress(1000);',
    // A sentence under a `*TestID` key is not an id.
    'const messages = { literalTestID: "Use the registry instead." };',
  ],
  invalid: [
    {
      code: 'const a = <View testID="pantry-list" />;',
      errors: ['literalTestID'],
    },
    {
      code: 'const b = <Row testID={`${prefix}-${action.key}`} />;',
      errors: ['literalTestID'],
    },
    {
      code: "const c = <Field testID={testID ? `${testID}-search` : 'fallback-id'} />;",
      errors: ['literalTestID'],
    },
    {
      code: 'const d = <Sheet confirmTestID="report-item-submit-button" />;',
      errors: ['literalTestID'],
    },
    {
      code: "const e = { testIDPrefix: 'add-pantry-item' };",
      errors: ['literalTestID'],
    },
    {
      code: "element(by.id('header-back-button'));",
      errors: ['literalTestID'],
    },
    {
      code: "const Tabs = ({ testIDPrefix = 'filter-tab' }) => null;",
      errors: ['literalTestID'],
    },
    {
      code: 'element(by.id(/^shopping-list-item-.+-delete$/));',
      errors: ['literalTestID'],
    },
    {
      code: "element(by.text('Purchased')).tap();",
      errors: ['literalCopyMatcher'],
    },
    {
      code: 'element(by.text(`Skip all`));',
      errors: ['literalCopyMatcher'],
    },
    {
      code: "element(by.label(isIOS ? 'Skip tutorial' : label));",
      errors: ['literalCopyMatcher'],
    },
    {
      code: 'element(by.id(sheet.title)).tap({ x: 20, y: 12 });',
      errors: ['pointTap'],
    },
    {
      code: 'element(by.id(sheet.title)).longPress({ x: 20, y: 12 }, 800);',
      errors: ['pointTap'],
    },
    {
      code: 'element(by.id(sheet.title)).tapAtPoint(point);',
      errors: ['pointTap'],
    },
    {
      code: 'device.tap(point);',
      errors: ['pointTap'],
    },
  ],
});

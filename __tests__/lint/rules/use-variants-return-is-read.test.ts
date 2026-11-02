import { testRule } from '#/test-utils/eslintRuleTester';

const inComponent = (body: string) =>
  `const C = ({ size }) => {\n${body}\n};\nconst styles = StyleSheet.create(theme => ({}));`;

testRule('use-variants-return-is-read', {
  valid: [
    inComponent(
      `const variantStyles = styles.useVariants({ size });
       return <View style={variantStyles.button} />;`,
    ),
    // A read above the call is the sheet's own.
    inComponent(
      `const base = styles.button;
       const variantStyles = styles.useVariants({ size });
       return <View style={[base, variantStyles.icon]} />;`,
    ),
    // A second call in another branch reads its own return.
    inComponent(
      `const variantStyles = styles.useVariants({ size });
       if (size) {
         const variantStyles2 = styles.useVariants({ size: 'lg' });
         return <View style={variantStyles2.button} />;
       }
       return <View style={variantStyles.button} />;`,
    ),
    // Another component in the file selected no variants.
    `const A = ({ size }) => {
       const variantStyles = styles.useVariants({ size });
       return <View style={variantStyles.button} />;
     };
     const B = () => <View style={styles.plain} />;
     const styles = StyleSheet.create(theme => ({}));`,
    // A type read is no render read.
    inComponent(
      `const variantStyles = styles.useVariants({ size });
       type Sheet = typeof styles;
       return <View style={variantStyles.button} />;`,
    ),
  ],
  invalid: [
    {
      code: inComponent(
        `styles.useVariants({ size });
         return <View style={styles.button} />;`,
      ),
      errors: ['bareCall'],
    },
    {
      code: inComponent(
        `circleStyles.useVariants({ size });
         return null;`,
      ),
      errors: ['bareCall'],
    },
    {
      code: inComponent(
        `const variantStyles = styles.useVariants({ size });
         return <View style={[variantStyles.button, styles.icon]} />;`,
      ),
      errors: ['sheetRead'],
    },
    // Handing the sheet on loses the variants the same way.
    {
      code: inComponent(
        `const variantStyles = styles.useVariants({ size });
         return <Child variantStyles={variantStyles} styles={styles} />;`,
      ),
      errors: ['sheetRead'],
    },
  ],
});

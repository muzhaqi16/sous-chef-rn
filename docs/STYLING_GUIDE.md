# Styling Guide - Quick Reference

This guide provides quick reference for consistent styling across the Sous Chef app.

## Table of Contents
1. [Always Use Theme Tokens](#always-use-theme-tokens)
2. [Common Patterns](#common-patterns)
3. [Available Components](#available-components)
4. [Quick Dos and Don'ts](#quick-dos-and-donts)

---

## Always Use Theme Tokens

### ✅ DO
```typescript
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.md,           // ✅
    borderRadius: theme.radii.md,        // ✅
    backgroundColor: theme.colors.surface, // ✅
    fontSize: theme.fonts.size.md,       // ✅
  }
}));
```

### ❌ DON'T
```typescript
const styles = StyleSheet.create({
  container: {
    padding: 16,              // ❌ Magic number
    borderRadius: 8,          // ❌ Magic number
    backgroundColor: '#FFF',  // ❌ Hardcoded color
    fontSize: 14,             // ❌ Magic number
  }
});
```

---

## Theme Reference

### Spacing
```typescript
theme.spacing.xs    // 4
theme.spacing.sm    // 8
theme.spacing.md    // 16
theme.spacing.lg    // 24
theme.spacing.xl    // 32
theme.spacing['2xl'] // 48
theme.spacing['3xl'] // 64
```

### Border Radius
```typescript
theme.radii.sm   // 4
theme.radii.md   // 8
theme.radii.lg   // 12
theme.radii.xl   // 16
theme.radii.full // 9999
```

### Colors
```typescript
// Primary
theme.colors.primary
theme.colors.primaryLight
theme.colors.primaryDark

// Text
theme.colors.textPrimary
theme.colors.textSecondary
theme.colors.textTertiary

// Background
theme.colors.background
theme.colors.surface

// Borders
theme.colors.border
theme.colors.borderLight
theme.colors.divider

// Semantic
theme.colors.success
theme.colors.warning
theme.colors.error
theme.colors.info

// Utility
theme.colors.white
theme.colors.black
theme.colors.transparent
```

### Typography
```typescript
// Font Sizes
theme.fonts.size.xs    // 12
theme.fonts.size.sm    // 14
theme.fonts.size.base  // 16
theme.fonts.size.md    // 16
theme.fonts.size.lg    // 18
theme.fonts.size.xl    // 20
theme.fonts.size['2xl'] // 24
theme.fonts.size['3xl'] // 30
theme.fonts.size['4xl'] // 36

// Font Weights
theme.fonts.weight.regular  // '400'
theme.fonts.weight.medium   // '500'
theme.fonts.weight.semibold // '600'
theme.fonts.weight.bold     // '700'
```

---

## Common Patterns

### Use commonStyles for Standard Layouts

```typescript
import { commonStyles } from '#styles';

// Containers
<View style={commonStyles.container} />
<View style={commonStyles.containerPadded} />
<View style={commonStyles.containerCentered} />

// Flex Layouts
<View style={commonStyles.row} />
<View style={commonStyles.rowSpaceBetween} />
<View style={commonStyles.column} />

// Cards
<View style={commonStyles.card} />
<View style={commonStyles.cardWithShadow} />

// Typography
<Text style={commonStyles.h1} />
<Text style={commonStyles.h2} />
<Text style={commonStyles.body} />
<Text style={commonStyles.caption} />
```

### Combining Styles
```typescript
<Text style={[commonStyles.title, styles.customTitle]}>
  My Title
</Text>
```

---

## Available Components

### Base Components
```typescript
import { Button, FAB, Input, Badge } from '#components/base';

<Button title="Save" onPress={handleSave} />
<Input label="Email" value={email} onChangeText={setEmail} />
<Badge>New</Badge>
```

### Atom Components
```typescript
import {
  EmailInput,
  PasswordInput,
  BaseInput,
  PhoneInput,
  DateInput,
  IconButton
} from '#components/atoms';

<EmailInput label="Email" value={email} onChangeText={setEmail} />
<PasswordInput label="Password" value={password} onChangeText={setPassword} />
```

### Template Components
```typescript
import { AuthWrapper, AuthFormTemplate } from '#components/templates';

<AuthWrapper>
  <AuthFormTemplate
    title="Sign In"
    subtitle="Welcome back"
    fields={[...]}
    control={form.control}
    errors={form.formState.errors}
    onSubmit={form.handleSubmit(onSubmit)}
  />
</AuthWrapper>
```

```typescript
import { OnBoardingWrapper } from '#components/templates';

<OnBoardingWrapper
  title="Welcome"
  subtitle="Let's get started"
  step={1}
  totalSteps={7}
>
  {/* Your content */}
</OnBoardingWrapper>
```

```typescript
import { ListTemplate } from '#components/templates';

<ListTemplate
  title="Pantry"
  subtitle="your pantry"
  items={items}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  onItemPress={handleItemPress}
  showHeader={true}
  showSearchBar={true}
  emptyState={{
    icon: 'inventory',
    title: 'No items',
    description: 'Add items to get started'
  }}
/>
```

```typescript
import { DetailTemplate } from '#components/templates';

<DetailTemplate
  title="Item Details"
  onBack={goBack}
  headerActions={[
    { icon: 'edit', onPress: handleEdit },
    { icon: 'delete', onPress: handleDelete, color: theme.colors.error }
  ]}
  sections={[...]}
  primaryAction={{
    label: 'Save Changes',
    onPress: handleSave
  }}
/>
```

### Organism Components
```typescript
import {
  SearchBar,
  UserHeader,
  EmptyState,
  AnimatedItemSelector,
  SortableShoppingList
} from '#components/organisms';
```

---

## Quick Dos and Don'ts

### Spacing

#### ✅ DO
```typescript
padding: theme.spacing.md
marginBottom: theme.spacing.sm
gap: theme.spacing.lg
```

#### ❌ DON'T
```typescript
padding: 16
marginBottom: 8
gap: 24
```

### Border Radius

#### ✅ DO
```typescript
borderRadius: theme.radii.md
borderRadius: theme.radii.lg
```

#### ❌ DON'T
```typescript
borderRadius: 8
borderRadius: theme.spacing.sm  // Wrong! Use theme.radii
```

### Colors

#### ✅ DO
```typescript
color: theme.colors.textPrimary
backgroundColor: theme.colors.surface
borderColor: theme.colors.border
```

#### ❌ DON'T
```typescript
color: '#000'
backgroundColor: '#FFF'
borderColor: '#E0E0E0'
```

### Typography

#### ✅ DO
```typescript
fontSize: theme.fonts.size.md
fontWeight: theme.fonts.weight.semibold
```

#### ❌ DON'T
```typescript
fontSize: 16
fontWeight: '600'
```

---

## Common Screen Patterns

### Screen with Header and List
```typescript
import { View } from 'react-native';
import { ListTemplate } from '#components';
import { commonStyles } from '#styles';

export const MyScreen = () => {
  return (
    <View style={commonStyles.container}>
      <ListTemplate
        title="My Items"
        items={items}
        onItemPress={handlePress}
        emptyState={{
          icon: 'inbox',
          title: 'No items yet',
          description: 'Add your first item'
        }}
      />
    </View>
  );
};
```

### Form Screen
```typescript
import { FormModal } from '#components/organisms/FormModal';
import { Input } from '#components/base/Input';

export const MyFormScreen = () => {
  return (
    <FormModal
      title="Add Item"
      onClose={handleClose}
      onSave={handleSave}
      loading={saving}
    >
      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        required
      />
    </FormModal>
  );
};
```

### Detail Screen
```typescript
import { DetailTemplate } from '#components/templates/DetailTemplate';

export const MyDetailScreen = () => {
  return (
    <DetailTemplate
      title="Details"
      onBack={goBack}
      sections={[
        {
          title: 'Information',
          content: <View>...</View>
        }
      ]}
    />
  );
};
```

---

## Image Styling Pattern

### ✅ Recommended Pattern
```typescript
const styles = StyleSheet.create(theme => ({
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  }
}));
```

---

## Button Patterns

### Primary Button
```typescript
<Button
  title="Save"
  onPress={handleSave}
  btnStyle={commonStyles.buttonPrimary}
  txtStyle={commonStyles.buttonTextPrimary}
/>
```

### Secondary Button
```typescript
<Button
  title="Cancel"
  onPress={handleCancel}
  btnStyle={commonStyles.buttonSecondary}
  txtStyle={commonStyles.buttonTextSecondary}
/>
```

### Destructive Button
```typescript
<Button
  title="Delete"
  onPress={handleDelete}
  btnStyle={commonStyles.buttonDanger}
  txtStyle={commonStyles.buttonTextPrimary}
/>
```

---

## Best Practices Checklist

Before submitting a PR, ensure:

- [ ] All styles use `StyleSheet.create(theme => ({...}))`
- [ ] No magic numbers for spacing (use `theme.spacing.*`)
- [ ] No magic numbers for border radius (use `theme.radii.*`)
- [ ] No hardcoded colors (use `theme.colors.*`)
- [ ] No hardcoded font sizes (use `theme.fonts.size.*`)
- [ ] Reused `commonStyles` where applicable
- [ ] Used template components when available
- [ ] Consistent with existing screen patterns

---

## Resources

- [Theme Definition](./src/theme/themes.ts)
- [Common Styles](./src/styles/commonStyles.ts)
- [Component Library](./src/components/)
- [UI Analysis Report](./UI_CONSISTENCY_ANALYSIS.md)

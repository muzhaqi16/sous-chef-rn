# Sous Chef React Native App

A React Native application for managing your home kitchen, pantry items, shopping lists, and recipes with offline-first architecture and real-time collaboration.

## Quick Start

### Development

```bash
npm install
npm start
```

## Running Android with Production Env Vars

The Android build reads environment variables via `react-native-config`. To launch with the production `.env` file:

- **macOS/Linux (bash/zsh):**

```bash
ENVFILE=.env.production npm run android
```

- **Windows Command Prompt:**

```cmd
set ENVFILE=.env.production && npm run android
```

- **Windows PowerShell:**

```powershell
env:ENVFILE=".env.production"; npm run android
```

### Clean Build (Android)

```bash
npx react-native clean
rm -rf android/app/build
rm -rf android/app/.cxx
```

## Architecture Overview

### State Management

This app uses a hybrid state management approach for optimal performance:

- **Zustand Store** (`useAppStore`): Global app state, user data, navigation state
- **Apollo Cache**: Server state management, GraphQL queries/mutations, optimistic updates

#### ⚠️ Important: Use Selective Subscriptions

**❌ Bad Pattern** (causes unnecessary re-renders):

```typescript
import { useStore } from '#store';
const { user, accessToken, setSelectedHomeId } = useStore();
// This subscribes to ALL store changes!
```

**✅ Good Pattern** (selective re-renders):

```typescript
import { useAppStore, selectUser, selectAccessToken } from '#store/useAppStore';
const user = useAppStore(selectUser);
const accessToken = useAppStore(selectAccessToken);
const setSelectedHomeId = useAppStore(state => state.setSelectedHomeId);
// Only re-renders when selected values change!
```

#### When to Use Each:

- **useAppStore**: UI state, selections, user preferences, navigation state, biometric settings
- **Apollo Client** (useQuery/useMutation): GraphQL queries/mutations, server data, cache management

### Offline-First Architecture

The app is designed for offline-first operation with automatic sync:

- Apollo cache persists data locally
- Optimistic mutations provide instant UI feedback
- Automatic retry queue when connection restored
- Query data preservation prevents cascade failures

**Key Patterns:**

- Use `usePreservedArrayData` for array queries with `errorPolicy: 'ignore'`
- Use offline fetch policies from `apollo/policies/offlineFetchPolicies.ts`
- Prefer cache updates over `refetchQueries` for better performance

See `docs/apollo-client-patterns.md` for comprehensive documentation on:

- Cache update patterns (5 recommended patterns)
- Optimistic response patterns
- Error handling with version conflicts
- Subscription patterns
- Fetch policy decision trees

### Pagination

Reusable pagination is handled via the `PaginationFooter` component:

```typescript
import { PaginationFooter } from '#/components/organisms/PaginationFooter';
import { usePagination } from '#/hooks/utils/usePagination';

// In your component:
const { hasMore, loadMore, isLoadingMore } = usePagination({
  pageInfo: data?.pageInfo,
  loading,
  itemCount: items.length,
  fetchMore,
  cursorVariableName: 'cursor',
});

<FlatList
  data={items}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={
    <PaginationFooter
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loading={loading}
      itemCount={items.length}
    />
  }
/>;
```

### Performance Optimization

#### List Virtualization

**Always use `FlatList` for dynamic lists:**

- ✅ Use `FlatList` for any list with unbounded/dynamic items (shopping lists, pantry items, recipes)
- ✅ Use `SortableShoppingList` for drag-and-drop lists
- ✅ Use `ScrollView` only for static, bounded content (settings screens, forms)
- ❌ Never use `.map()` inside `ScrollView` for lists that can grow

**Example Conversions:**

```typescript
// ❌ Bad: Unbounded list in ScrollView
<ScrollView>
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</ScrollView>

// ✅ Good: Virtualized with FlatList
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={({ item }) => <ItemCard item={item} />}
/>
```

#### Query Optimization

- Use `useCrudOperations` hook for standardized create/update/delete patterns
- Use generic cache updaters from `apollo/utils/cacheUpdaters.ts`
- Leverage `usePagination` hook for infinite scroll lists

## Documentation

- **Apollo/GraphQL Patterns**: `docs/apollo-client-patterns.md` - Comprehensive guide with decision trees
- **Component Structure**: See individual README files in `src/components/*/README.md`
- **Codegen Instructions**: See `CLAUDE.md` for Claude AI assistant guidelines

## Development Guidelines

### Before Committing

Always run these commands to ensure code quality:

```bash
npm run typecheck  # Ensure no TypeScript errors
npm run lint       # Ensure code quality standards
```

### GraphQL Schema

To regenerate TypeScript types after backend schema changes:

```bash
npm run codegen
```

**Important Notes:**

- Type casting `__typename: 'Mutation' as any` is **never needed** with proper typing
- Use `theme.typography.fontSize.*` or `theme.fonts.size.*` (not `theme.fontSize.*`)
- Follow the patterns in `apollo-client-patterns.md` for cache updates

### Common Commands

```bash
npm start          # Start Metro bundler
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm test           # Run test suite
npm run lint:fix   # Auto-fix linting issues
```

## Project Structure

```
src/
├── components/     # Reusable UI components (atoms, molecules, organisms)
├── screens/        # Screen components for navigation
├── hooks/          # Custom React hooks
├── apollo/         # Apollo Client config, cache policies, links
├── store/          # Zustand store configuration
├── navigation/     # React Navigation setup
├── theme/          # Design system (colors, typography, spacing)
├── utils/          # Utility functions and helpers
└── graphql/        # Generated GraphQL types and operations
```

## Key Technologies

- **React Native** - Cross-platform mobile framework
- **TypeScript** - Type safety and better DX
- **Apollo Client** - GraphQL client with caching
- **Zustand** - Lightweight state management
- **React Navigation** - Navigation and routing
- **React Native Unistyles** - Theming and styling
- **Reanimated** - Smooth animations and gestures

## Contributing

1. Follow the patterns documented in `docs/apollo-client-patterns.md`
2. Use `useAppStore` with selectors (not `useStore()`)
3. Use `FlatList` for dynamic lists
4. Run typecheck and lint before commits
5. Add proper TypeScript types (avoid `any`)

## License

[Your License Here]

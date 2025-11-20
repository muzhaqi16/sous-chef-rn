- to regenerate the schema run npm run codegen
- always run npm run typecheck and npm run lint after making code changes to ensure no typescript and linting errors were introduced
- typecasting \_\_typename: 'Mutation' as any, is never needed

### Verification Commands

After implementing fixes, run:

```bash
npm run typecheck  # Verify TypeScript changes
npm run lint       # Verify code quality
npm test           # Run test suite
```

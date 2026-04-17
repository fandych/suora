# Testing Guide

This document describes the testing infrastructure for Suora.

## Test Framework

We use **Vitest 4.x** for unit and integration testing, with the following stack:

- **Vitest**: Fast unit test framework with native ESM support
- **@testing-library/react**: React component testing utilities
- **Playwright**: End-to-end testing for Electron app
- **jsdom**: Browser environment simulation for unit tests
- **@vitest/coverage-v8**: Code coverage reporting

## Running Tests

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Test Structure

Tests are colocated with their source files using the `.test.ts` or `.spec.ts` suffix:

```
src/
├── services/
│   ├── skillSecurity.ts
│   ├── skillSecurity.test.ts    # Unit tests
│   ├── vectorMemory.ts
│   └── vectorMemory.test.ts     # Unit tests
└── test/
    └── setup.ts                  # Global test setup

e2e/
└── (E2E tests)                   # Playwright tests
```

## Current Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| `skillSecurity.ts` | 30 tests | 100% |
| `vectorMemory.ts` | 41 tests | 100% |
| **Total** | **70 tests** | **~15% overall** |

### Coverage Goals

Minimum coverage thresholds are enforced:
- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { myFunction } from './myModule'

describe('myModule', () => {
  describe('myFunction', () => {
    it('should do something', () => {
      const result = myFunction('input')
      expect(result).toBe('expected')
    })
  })
})
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toBeTruthy()
})
```

### Mocking Electron APIs

Electron APIs are automatically mocked in test setup:

```typescript
// Available in all tests
window.electron.invoke('channel-name', args)
window.electron.on('channel-name', callback)
```

### Testing with localStorage

localStorage is mocked with actual storage in tests:

```typescript
it('should persist data', () => {
  localStorage.setItem('key', 'value')
  expect(localStorage.getItem('key')).toBe('value')
})
```

## Test Organization

Follow these principles:

1. **One describe block per function/class**
2. **Group related tests** with nested describe blocks
3. **Use clear test names** that describe behavior
4. **Test edge cases**: empty inputs, errors, boundaries
5. **Clean up after tests** using `beforeEach` and `afterEach`

### Good Test Names

✅ Good:
```typescript
it('should return empty array for empty input')
it('should throw error when input is invalid')
it('should compute hash consistently for same input')
```

❌ Bad:
```typescript
it('works')
it('test function')
it('should work correctly')
```

## Testing Checklist

When adding new code, ensure:

- [ ] All public functions have unit tests
- [ ] Edge cases are covered (empty, null, errors)
- [ ] Async operations are tested
- [ ] Error handling is tested
- [ ] Integration points are tested
- [ ] Tests are fast (< 100ms per test)
- [ ] Tests are isolated (no shared state)
- [ ] Coverage meets minimum thresholds

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Multiple Node.js versions (20.x, 22.x)
- Multiple OS (Ubuntu, Windows, macOS for builds)

## Debugging Tests

### Run specific test file
```bash
npm test src/services/skillSecurity.test.ts
```

### Run specific test by name
```bash
npm test -t "should compute hash"
```

### Debug in VS Code
Add breakpoints and run "JavaScript Debug Terminal"

### View coverage report
```bash
npm run test:coverage
open coverage/index.html
```

## Common Issues

### Tests timing out
- Increase timeout: `{ timeout: 10000 }`
- Check for unresolved promises

### Flaky tests
- Avoid time-dependent logic
- Use `vi.useFakeTimers()` for time-based tests
- Ensure proper cleanup

### Import errors
- Check file paths use `./` not `../`
- Verify `@/` alias in vitest.config.ts

## Next Steps

Priority areas for test coverage:

1. **agentCommunication.ts** - Agent delegation logic
2. **tools.ts** - Tool execution and validation
3. **channelService.ts** - Webhook handling
4. **customSkillRuntime.ts** - Code evaluation sandbox
5. **Component tests** - React UI components

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)

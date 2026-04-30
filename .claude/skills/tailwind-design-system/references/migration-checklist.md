# Tailwind v3 to v4 Migration Checklist

- [ ] Replace `@tailwind base/components/utilities` with `@import "tailwindcss"`.
- [ ] Move tokens from `tailwind.config.ts` to CSS `@theme` blocks.
- [ ] Convert color definitions to `--color-*` variables.
- [ ] Replace `darkMode: "class"` with `@custom-variant dark (&:where(.dark, .dark *))`.
- [ ] Move keyframes and animation tokens into CSS.
- [ ] Replace plugin-based animation patterns with native CSS where practical.
- [ ] Use `size-*` for equal width/height.
- [ ] In new React 19 components, prefer `ref` as a prop over `forwardRef`.
- [ ] Replace custom plugin utilities with `@utility` directives when possible.
- [ ] Test responsive layouts, focus states, reduced-motion expectations, and dark mode.

## Best practices

- Use OKLCH colors for perceptual consistency.
- Use semantic tokens instead of hardcoded palette classes.
- Keep component APIs small and predictable.
- Avoid arbitrary values when a reusable token would clarify intent.
- Do not introduce new dependencies for examples unless they are already used by the project or approved by the user.

---
name: tailwind-design-system
description: Build scalable Tailwind CSS v4 design systems with CSS-first tokens, accessible component patterns, responsive layouts, dark mode, and migration guidance. Use this skill whenever the user asks to create or standardize a component library, define design tokens, implement reusable UI patterns, improve Tailwind architecture, migrate Tailwind v3 to v4, or make a Tailwind UI more consistent and accessible.
---

# Tailwind Design System (v4)

Use this skill to produce production-ready Tailwind CSS v4 design systems. Favor CSS-first configuration, semantic tokens, accessible components, and responsive patterns that can scale across a codebase.

## Workflow

1. Inspect the project stack and Tailwind version before recommending implementation details.
2. Define the design-system intent: brand/tone, supported themes, component scope, accessibility requirements, and migration constraints.
3. Establish token hierarchy before components: brand tokens → semantic tokens → component tokens.
4. Build components from base styles, variants, sizes, states, then controlled overrides.
5. Validate both light and dark themes, keyboard/focus states, responsive behavior, and TypeScript ergonomics.

## Tailwind v4 defaults

- Use `@import "tailwindcss"` instead of `@tailwind base/components/utilities`.
- Use CSS `@theme` blocks instead of `tailwind.config.ts` for tokens.
- Use `@custom-variant dark (&:where(.dark, .dark *))` for class-based dark mode.
- Put animation tokens and keyframes in CSS; avoid adding animation plugins unless the project already uses them.
- Prefer semantic utilities such as `bg-primary` over hardcoded palette classes.
- Prefer `size-*` for equal width/height.
- For React 19, accept `ref` as a prop instead of adding `forwardRef` for new components.

## Bundled references

Read only the reference needed for the current task:

- `references/tailwind-v4-foundation.md` — CSS-first setup, token hierarchy, dark mode, and core utilities.
- `references/component-patterns.md` — Button, Card, form, grid, dialog/animation, and theme-provider patterns.
- `references/migration-checklist.md` — Tailwind v3 to v4 migration checklist and best practices.

## Output expectations

- Explain the design-system structure before making broad changes.
- Keep tokens semantic and document where each token belongs.
- Reuse project conventions and dependencies; do not add `class-variance-authority`, `tailwind-merge`, Radix, or form libraries unless they already exist or the user explicitly asks.
- Include accessibility behavior as part of component design, not as an afterthought.

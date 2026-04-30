# Component Patterns

Use these patterns as references. Adapt to project conventions and installed packages.

## Variant components

- Structure components as base styles → variants → sizes → states → overrides.
- Use a variant helper such as CVA only when it already exists or the user approves adding it.
- Keep focus rings and disabled states in the base styles so every variant inherits accessibility affordances.

```tsx
export function Button({ className, variant = 'default', size = 'md', ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className={buttonClass({ variant, size, className })} {...props} />
}
```

## Compound components

Build Card, Dialog, Menu, and similar primitives as small exported pieces that share tokens and can be composed without hidden layout assumptions.

```tsx
export function Card({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
}
```

## Forms

- Pair every input with a label.
- Use `aria-invalid`, `aria-describedby`, and `role="alert"` for errors.
- Keep error styling semantic (`border-destructive`, `text-destructive`).

## Responsive grids

Start mobile-first, then increase columns at `sm`, `md`, `lg`, and `xl`. Keep gap and container size configurable through variants or wrapper props.

## Animations

Prefer native CSS in Tailwind v4:

```css
@theme {
  --animate-dialog-in: dialog-fade-in 0.2s ease-out;
}

@keyframes dialog-fade-in {
  from { opacity: 0; transform: scale(0.95) translateY(-0.5rem); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

For popovers, pair transitions with `@starting-style` so entry and exit states are smooth.

## Theme provider

If the project needs a theme toggle, persist user choice, resolve `system` with `prefers-color-scheme`, update the root `dark` class, and include an accessible label on the toggle button.

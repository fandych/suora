import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './button'

describe('shared Button', () => {
  it('does not forward styling-only props to unstyled native buttons', () => {
    render(
      <Button unstyled variant="danger" color="red" outline plain data-testid="unstyled-button">
        Remove
      </Button>,
    )

    const button = screen.getByTestId('unstyled-button')
    expect(button).not.toHaveAttribute('unstyled')
    expect(button).not.toHaveAttribute('variant')
    expect(button).not.toHaveAttribute('color')
    expect(button).not.toHaveAttribute('outline')
    expect(button).not.toHaveAttribute('plain')
  })
})
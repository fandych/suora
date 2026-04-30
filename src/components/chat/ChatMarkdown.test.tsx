import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownContent } from './ChatMarkdown'

describe('MarkdownContent', () => {
  it('renders inline and block math formulas with KaTeX', () => {
    const { container } = render(
      <div className="markdown-body">
        <MarkdownContent content={'Inline $E=mc^2$\n\n$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$'} />
      </div>,
    )

    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.katex-display')).toBeTruthy()
  })

  it('keeps GitHub-flavored Markdown features working', () => {
    render(
      <MarkdownContent content={'| Name | Value |\n| --- | --- |\n| alpha | `beta` |\n\n- [x] done'} />,
    )

    expect(screen.getByRole('table')).toBeVisible()
    expect(screen.getByText('alpha')).toBeVisible()
    expect(screen.getByText('beta')).toBeVisible()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
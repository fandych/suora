import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MarkdownEditor } from './SkillEditorPanels'

function EditorHarness({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  return <MarkdownEditor value={value} onChange={setValue} placeholder="Write skill markdown" />
}

describe('MarkdownEditor', () => {
  it('renders the shared markdown preview for skill instructions', async () => {
    const user = userEvent.setup()
    render(
      <EditorHarness initialValue={`## Role\n\n- Be precise\n\n\
\
\
\
\`\`\`ts\nconst answer = 42\n\`\`\``} />,
    )

    await user.click(screen.getByRole('button', { name: 'Preview' }))

    expect(screen.getByRole('heading', { name: 'Role' })).toBeVisible()
    expect(screen.getByText('Be precise')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeVisible()
    expect(screen.getByText('const answer = 42')).toBeVisible()
  })
})
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SystemPromptMarkdownEditor } from './SystemPromptMarkdownEditor'
import { useAppStore } from '@/store/appStore'

function EditorHarness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  return <SystemPromptMarkdownEditor value={value} onChange={setValue} placeholder="Write system markdown" />
}

describe('SystemPromptMarkdownEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({ locale: 'en' })
  })

  it('edits and previews Markdown system prompts', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.type(screen.getByPlaceholderText('Write system markdown'), '## Role\n- Be precise')
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    expect(screen.getByRole('heading', { name: 'Role' })).toBeVisible()
    expect(screen.getByText('Be precise')).toBeVisible()
  })

  it('inserts Markdown snippets in write mode', async () => {
    const user = userEvent.setup()
    render(<EditorHarness />)

    await user.click(screen.getByRole('button', { name: 'Heading' }))

    expect(screen.getByDisplayValue('## instruction')).toBeVisible()
  })

  it('localizes the write mode label in Chinese', () => {
    useAppStore.setState({ locale: 'zh' })

    render(<EditorHarness />)

    expect(screen.getByRole('button', { name: '编写' })).toBeVisible()
  })
})
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkbenchEmptyState } from './empty-state'

describe('WorkbenchEmptyState', () => {
  it('renders metrics without injecting ordinal badges into the stat cards', () => {
    render(
      <WorkbenchEmptyState
        icon={<span>icon</span>}
        title="Empty"
        metrics={[
          { label: 'Total', value: '0', description: 'scheduled items' },
          { label: 'Enabled', value: '0', description: 'currently active' },
        ]}
      />,
    )

    expect(screen.getByText('Total')).toBeVisible()
    expect(screen.getByText('Enabled')).toBeVisible()
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })
})